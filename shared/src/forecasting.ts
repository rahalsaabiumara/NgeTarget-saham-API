import { round } from './calculation';
import type { ForecastInput, ForecastPoint, ForecastResult } from './types';

export const TRADING_DAYS_PER_YEAR = 252;
export const TRADING_DAYS_PER_MONTH = 21;
export const MIN_HISTORY_POINTS = 20;

export const DEFAULT_ANNUAL_RETURN_PCT = 8;
export const DEFAULT_ANNUAL_VOLATILITY_PCT = 20;

/** Batas wajar return tahunan agar proyeksi tidak ekstrem akibat outlier jangka pendek. */
export const ANNUAL_RETURN_CLAMP = { min: -60, max: 80 } as const;

export interface DailyStats {
  drift: number;
  volatility: number;
  sampleSize: number;
}

/** Menghitung rata-rata return harian (drift) dan simpangan bakunya dari harga penutupan. */
export function computeDailyStats(closes: number[]): DailyStats {
  const clean = closes.filter((c) => Number.isFinite(c) && c > 0);
  const returns: number[] = [];
  for (let i = 1; i < clean.length; i++) {
    returns.push(clean[i] / clean[i - 1] - 1);
  }
  const n = returns.length;
  if (n === 0) return { drift: 0, volatility: 0, sampleSize: 0 };
  const mean = returns.reduce((a, b) => a + b, 0) / n;
  const variance = n > 1 ? returns.reduce((a, r) => a + (r - mean) ** 2, 0) / (n - 1) : 0;
  return { drift: mean, volatility: Math.sqrt(variance), sampleSize: n };
}

export const annualToDailyReturn = (annualPct: number) =>
  (1 + annualPct / 100) ** (1 / TRADING_DAYS_PER_YEAR) - 1;
export const dailyToAnnualReturnPct = (daily: number) =>
  ((1 + daily) ** TRADING_DAYS_PER_YEAR - 1) * 100;
export const annualToDailyVol = (annualPct: number) =>
  annualPct / 100 / Math.sqrt(TRADING_DAYS_PER_YEAR);
export const dailyToAnnualVolPct = (daily: number) => daily * Math.sqrt(TRADING_DAYS_PER_YEAR) * 100;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function addMonths(isoDate: string, months: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.toISOString().slice(0, 10);
}

/**
 * Model forecasting sederhana (lihat PRD §3.2):
 *   Base : V(t) = A × (1 + r)^t + akumulasi setoran bulanan yang ikut bertumbuh
 *   Bull : Base × (1 + 0,5·σ·√t)
 *   Bear : Base × (1 − 0,5·σ·√t)
 * dengan t = 21 × bulan (hari bursa), r = drift harian, σ = volatilitas harian.
 */
export function forecastPortfolio(input: ForecastInput): ForecastResult {
  const months = clamp(Math.round(input.months), 1, 60);
  const contribution = Math.max(0, input.monthlyContribution ?? 0);
  const startDate = input.startDate ?? new Date().toISOString().slice(0, 10);
  const closes = input.historicalCloses ?? [];

  let method: ForecastResult['method'] = 'assumption';
  let drift: number;
  let vol: number;
  let sampleSize = 0;
  let rawAnnualizedReturnPct: number | null = null;

  if (closes.length >= MIN_HISTORY_POINTS) {
    const stats = computeDailyStats(closes);
    method = 'historical';
    sampleSize = stats.sampleSize;
    rawAnnualizedReturnPct = dailyToAnnualReturnPct(stats.drift);
    const clampedAnnual = clamp(rawAnnualizedReturnPct, ANNUAL_RETURN_CLAMP.min, ANNUAL_RETURN_CLAMP.max);
    drift = annualToDailyReturn(clampedAnnual);
    vol = stats.volatility;
  } else {
    drift = annualToDailyReturn(input.annualReturnPct ?? DEFAULT_ANNUAL_RETURN_PCT);
    vol = annualToDailyVol(input.annualVolatilityPct ?? DEFAULT_ANNUAL_VOLATILITY_PCT);
  }

  const monthlyGrowth = (1 + drift) ** TRADING_DAYS_PER_MONTH;
  const targetFactor = 1 + input.targetPct / 100;
  const points: ForecastPoint[] = [];

  let contributionPool = 0; // nilai akumulasi setoran (ikut bertumbuh)
  for (let m = 0; m <= months; m++) {
    if (m > 0) contributionPool = contributionPool * monthlyGrowth + contribution;
    const t = TRADING_DAYS_PER_MONTH * m;
    const base = input.currentAssetValue * (1 + drift) ** t + contributionPool;
    const band = 0.5 * vol * Math.sqrt(t);
    const invested = input.initialCapital + contribution * m;
    points.push({
      month: m,
      date: addMonths(startDate, m),
      invested: round(invested),
      targetValue: round(invested * targetFactor),
      base: round(base),
      bull: round(base * (1 + band)),
      bear: round(Math.max(0, base * (1 - band))),
    });
  }

  const firstHit = (key: 'base' | 'bull' | 'bear') => {
    const hit = points.find((p) => p[key] >= p.targetValue);
    return hit ? hit.month : null;
  };

  return {
    method,
    sampleSize,
    dailyDrift: drift,
    dailyVolatility: vol,
    annualizedReturnPct: round(dailyToAnnualReturnPct(drift)),
    annualizedVolatilityPct: round(dailyToAnnualVolPct(vol)),
    rawAnnualizedReturnPct: rawAnnualizedReturnPct != null ? round(rawAnnualizedReturnPct) : null,
    points,
    targetHitMonth: { base: firstHit('base'), bull: firstHit('bull'), bear: firstHit('bear') },
  };
}

