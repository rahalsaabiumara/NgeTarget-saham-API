import YahooFinance from 'yahoo-finance2';
import type { PricePoint, StockQuote } from '@portocalc/shared';
import { prisma } from '../lib/prisma';
import { HttpError } from '../lib/errors';
import { GOLD_IDR_GRAM_SYMBOL, IDX_STOCKS, normalizeSymbol } from '../data/idxStocks';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const TROY_OUNCE_GRAMS = 31.1034768;
const QUOTE_TTL_MS = 60_000;
const HISTORY_TTL_MS = 30 * 60_000;

/* ------------------------------ Cache memori ------------------------------ */
interface CacheEntry<T> {
  value: T;
  expires: number;
}
const quoteCache = new Map<string, CacheEntry<StockQuote>>();
const historyCache = new Map<string, CacheEntry<PricePoint[]>>();

function fromCache<T>(map: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const hit = map.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  return undefined;
}

/* ---------------------------------- Quote --------------------------------- */

async function fetchYahooQuote(symbol: string): Promise<StockQuote> {
  const q = await yf.quote(symbol);
  if (!q || q.regularMarketPrice == null) {
    throw new HttpError(404, `Harga untuk ${symbol} tidak ditemukan.`);
  }
  const last = q.regularMarketPrice;
  const hasBidAsk = (q.bid ?? 0) > 0 && (q.ask ?? 0) > 0;
  const listed = IDX_STOCKS.find((s) => s.symbol === symbol);
  return {
    symbol,
    name: q.longName ?? q.shortName ?? listed?.name ?? symbol,
    currency: q.currency ?? 'IDR',
    buyPrice: hasBidAsk ? q.ask! : last,
    sellPrice: hasBidAsk ? q.bid! : last,
    lastPrice: last,
    changePct: q.regularMarketChangePercent ?? null,
    marketState: q.marketState ?? null,
    source: 'live',
    priceBasis: hasBidAsk
      ? 'BELI = ask (offer), JUAL = bid — harga per lembar'
      : 'Bid/ask tidak tersedia (pasar tutup) — BELI & JUAL memakai harga terakhir per lembar',
    fetchedAt: new Date().toISOString(),
  };
}

/** Emas spot dunia dikonversi ke Rupiah/gram: GC=F (USD/oz) × USDIDR ÷ 31,1035. */
async function fetchGoldIdrPerGram(): Promise<StockQuote> {
  const [gold, fx] = await Promise.all([yf.quote('GC=F'), yf.quote('IDR=X')]);
  const usdPerOz = gold?.regularMarketPrice;
  const idrPerUsd = fx?.regularMarketPrice;
  if (!usdPerOz || !idrPerUsd) throw new HttpError(502, 'Harga emas spot tidak tersedia.');
  const perGram = (usdPerOz * idrPerUsd) / TROY_OUNCE_GRAMS;
  return {
    symbol: GOLD_IDR_GRAM_SYMBOL,
    name: 'Emas Spot Dunia (Rp per gram)',
    currency: 'IDR',
    buyPrice: Math.round(perGram),
    sellPrice: Math.round(perGram),
    lastPrice: Math.round(perGram),
    changePct: gold.regularMarketChangePercent ?? null,
    marketState: gold.marketState ?? null,
    source: 'live',
    priceBasis:
      'Harga spot (tanpa spread). Untuk emas fisik/buyback, sesuaikan BELI & JUAL secara manual.',
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Ambil harga terbaru. Urutan: cache memori (60 dtk) → API live → harga terakhir di SQLite.
 */
export async function getQuote(rawSymbol: string): Promise<StockQuote> {
  const symbol = normalizeSymbol(rawSymbol);
  if (!symbol) throw new HttpError(400, 'Simbol wajib diisi.');

  const cached = fromCache(quoteCache, symbol);
  if (cached) return cached;

  try {
    const quote =
      symbol === GOLD_IDR_GRAM_SYMBOL ? await fetchGoldIdrPerGram() : await fetchYahooQuote(symbol);
    quoteCache.set(symbol, { value: quote, expires: Date.now() + QUOTE_TTL_MS });
    await persistQuote(quote).catch((e) => console.warn('[market] gagal menyimpan cache:', e));
    return quote;
  } catch (err) {
    const stored = await prisma.marketQuoteCache.findUnique({ where: { symbol } });
    if (stored) {
      return {
        symbol: stored.symbol,
        name: stored.name,
        currency: stored.currency,
        buyPrice: stored.buyPrice,
        sellPrice: stored.sellPrice,
        lastPrice: stored.lastPrice,
        changePct: stored.changePct,
        marketState: null,
        source: 'cache',
        priceBasis: `${stored.priceBasis} (data tersimpan — API sedang tidak tersedia)`,
        fetchedAt: stored.fetchedAt.toISOString(),
      };
    }
    if (err instanceof HttpError) throw err;
    console.warn(`[market] quote ${symbol} gagal:`, (err as Error).message);
    throw new HttpError(
      502,
      `Gagal mengambil harga ${symbol} dari Yahoo Finance. Silakan isi harga BELI/JUAL secara manual.`,
    );
  }
}

async function persistQuote(q: StockQuote) {
  const data = {
    name: q.name,
    currency: q.currency,
    buyPrice: q.buyPrice,
    sellPrice: q.sellPrice,
    lastPrice: q.lastPrice,
    changePct: q.changePct,
    priceBasis: q.priceBasis,
    fetchedAt: new Date(q.fetchedAt),
  };
  await prisma.marketQuoteCache.upsert({
    where: { symbol: q.symbol },
    create: { symbol: q.symbol, ...data },
    update: data,
  });
}

/* -------------------------------- History --------------------------------- */

const RANGE_DAYS: Record<string, number> = { '1m': 31, '3m': 92, '6m': 183, '1y': 366 };

/** Harga penutupan harian (urut lama → baru) untuk grafik & forecasting. */
export async function getHistory(rawSymbol: string, range = '3m'): Promise<PricePoint[]> {
  const symbol = normalizeSymbol(rawSymbol);
  const key = `${symbol}:${range}`;
  const cached = fromCache(historyCache, key);
  if (cached) return cached;

  const days = RANGE_DAYS[range] ?? 92;
  const period1 = new Date(Date.now() - days * 86_400_000);

  let points: PricePoint[];
  if (symbol === GOLD_IDR_GRAM_SYMBOL) {
    const [gold, fx] = await Promise.all([
      yf.chart('GC=F', { period1, interval: '1d' }),
      yf.chart('IDR=X', { period1, interval: '1d' }),
    ]);
    const fxByDate = new Map(
      fx.quotes.filter((q) => q.close != null).map((q) => [toIsoDate(q.date), q.close as number]),
    );
    let lastFx = fx.quotes.find((q) => q.close != null)?.close ?? 0;
    points = [];
    for (const q of gold.quotes) {
      if (q.close == null) continue;
      const d = toIsoDate(q.date);
      lastFx = fxByDate.get(d) ?? lastFx;
      if (lastFx) points.push({ date: d, close: Math.round((q.close * lastFx) / TROY_OUNCE_GRAMS) });
    }
  } else {
    const chart = await yf.chart(symbol, { period1, interval: '1d' });
    points = chart.quotes
      .filter((q) => q.close != null && q.close > 0)
      .map((q) => ({ date: toIsoDate(q.date), close: q.close as number }));
  }

  historyCache.set(key, { value: points, expires: Date.now() + HISTORY_TTL_MS });
  return points;
}

/* --------------------------------- Search --------------------------------- */

export async function searchSymbols(query: string) {
  const q = query.trim();
  if (q.length < 2) return [];
  const local = IDX_STOCKS.filter(
    (s) => s.symbol.toLowerCase().includes(q.toLowerCase()) || s.name.toLowerCase().includes(q.toLowerCase()),
  );
  try {
    const res = await yf.search(q, { quotesCount: 10, newsCount: 0 });
    const remote = res.quotes
      .filter((r): r is typeof r & { symbol: string } => 'symbol' in r && typeof r.symbol === 'string')
      .filter((r) => r.symbol.endsWith('.JK'))
      .map((r) => ({
        symbol: r.symbol,
        name: ('longname' in r && r.longname) || ('shortname' in r && r.shortname) || r.symbol,
        sector: ('sector' in r && typeof r.sector === 'string' && r.sector) || 'IDX',
        category: 'saham' as const,
      }));
    const seen = new Set(local.map((s) => s.symbol));
    return [...local, ...remote.filter((r) => !seen.has(r.symbol))];
  } catch {
    return local;
  }
}

function toIsoDate(d: Date | string): string {
  return new Date(d).toISOString().slice(0, 10);
}

