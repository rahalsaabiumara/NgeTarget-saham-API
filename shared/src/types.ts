/**
 * Tipe data bersama antara backend dan frontend.
 * Nama field mengikuti kolom spreadsheet referensi:
 * BELI | JUAL | %RUGI | TANGGAL | ASET SAAT INI | MODAL AWAL | L/R | %L/R | TARGET >X%
 */

/** Cara menentukan nilai ASET SAAT INI. */
export type AssetValueMode =
  /** Pengguna mengetik langsung nilai aset (persis seperti spreadsheet). */
  | 'manual'
  /** Dihitung dari jumlah unit × harga jual, atau modal × (jual / beli) bila unit kosong. */
  | 'auto';

export interface CalculationInput {
  /** BELI — harga beli per unit (lembar / gram). */
  buyPrice: number;
  /** JUAL — harga jual / buyback per unit saat ini. */
  sellPrice: number;
  /** MODAL AWAL. */
  initialCapital: number;
  /** ASET SAAT INI — wajib bila mode `manual`. */
  currentAssetValue?: number | null;
  /** TARGET % (default 10). */
  targetPct: number;
  assetValueMode?: AssetValueMode;
  /** Jumlah unit dimiliki (opsional, dipakai pada mode `auto`). */
  units?: number | null;
}

export interface CalculationResult {
  buyPrice: number;
  sellPrice: number;
  /** %RUGI — selisih harga beli vs jual terhadap harga beli (spread). */
  spreadLossPct: number;
  /** ASET SAAT INI. */
  currentAssetValue: number;
  /** MODAL AWAL. */
  initialCapital: number;
  /** L/R nominal. */
  profitLossNominal: number;
  /** %L/R. */
  profitLossPct: number;
  targetPct: number;
  /** Nilai aset yang dibutuhkan agar target tercapai. */
  targetAssetValue: number;
  /** Kekurangan nominal menuju target (0 bila sudah tercapai). */
  shortfallToTarget: number;
  /** TARGET >X% tercapai? */
  isTargetMet: boolean;
  targetStatusLabel: 'Tercapai' | 'Belum Tercapai';
  /** Harga jual minimal agar posisi impas (L/R = 0). Null bila tidak dapat dihitung. */
  breakEvenSellPrice: number | null;
  /** Harga jual minimal agar target tercapai. Null bila tidak dapat dihitung. */
  requiredSellPriceForTarget: number | null;
  /** Kenaikan harga jual (%) yang dibutuhkan menuju target. */
  requiredPriceChangePct: number | null;
}

/** Satu baris catatan portofolio (aktual maupun simulasi). */
export interface PortfolioRecord extends CalculationResult {
  id: string;
  symbol: string;
  assetName: string;
  /** TANGGAL dalam format ISO `YYYY-MM-DD`. */
  recordDate: string;
  assetValueMode: AssetValueMode;
  units: number | null;
  isSimulation: boolean;
  notes: string | null;
  hasAiInsight: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Payload simpan/ubah catatan portofolio. */
export interface PortfolioRecordInput extends CalculationInput {
  symbol: string;
  assetName: string;
  recordDate: string;
  isSimulation?: boolean;
  notes?: string | null;
}

/* ------------------------------ Market data ------------------------------ */

export type AssetCategory = 'saham' | 'emas' | 'custom';

export interface StockListItem {
  symbol: string;
  name: string;
  sector: string;
  category: AssetCategory;
}

export interface StockQuote {
  symbol: string;
  name: string;
  currency: string;
  /** Harga beli (ask) — fallback ke harga terakhir bila ask tidak tersedia. */
  buyPrice: number;
  /** Harga jual (bid) — fallback ke harga terakhir bila bid tidak tersedia. */
  sellPrice: number;
  lastPrice: number;
  changePct: number | null;
  marketState: string | null;
  /** `live` = langsung dari API, `cache` = harga terakhir yang tersimpan di SQLite. */
  source: 'live' | 'cache';
  /** Keterangan dasar harga (mis. bid/ask atau harga penutupan). */
  priceBasis: string;
  fetchedAt: string;
}

export interface PricePoint {
  date: string;
  close: number;
}

/* ------------------------------- Forecasting ------------------------------ */

export type ForecastMethod = 'historical' | 'assumption';

export interface ForecastInput {
  currentAssetValue: number;
  initialCapital: number;
  targetPct: number;
  /** Horizon proyeksi dalam bulan (1–60). */
  months: number;
  /** Setoran rutin per bulan (DCA). */
  monthlyContribution?: number;
  /** Asumsi return tahunan (%) — dipakai pada metode `assumption`. */
  annualReturnPct?: number;
  /** Asumsi volatilitas tahunan (%) — dipakai pada metode `assumption`. */
  annualVolatilityPct?: number;
  /** Harga penutupan historis (urut lama → baru). Bila cukup, metode `historical` dipakai. */
  historicalCloses?: number[];
  /** Tanggal awal proyeksi (ISO). Default: hari ini. */
  startDate?: string;
}

export interface ForecastPoint {
  month: number;
  date: string;
  /** Total modal disetor (modal awal + setoran bulanan). */
  invested: number;
  /** Nilai aset yang dibutuhkan agar target tercapai pada bulan tersebut. */
  targetValue: number;
  base: number;
  bull: number;
  bear: number;
}

export interface ForecastResult {
  method: ForecastMethod;
  sampleSize: number;
  dailyDrift: number;
  dailyVolatility: number;
  annualizedReturnPct: number;
  annualizedVolatilityPct: number;
  /** Return tahunan historis sebelum dibatasi (clamp), bila metode historical. */
  rawAnnualizedReturnPct: number | null;
  points: ForecastPoint[];
  /** Bulan pertama target tercapai per skenario (null = tidak tercapai dalam horizon). */
  targetHitMonth: { base: number | null; bull: number | null; bear: number | null };
}

/* --------------------------------- AI ------------------------------------ */

export type RiskLevel = 'rendah' | 'sedang' | 'tinggi';

export interface AiRecommendation {
  title: string;
  detail: string;
}

export interface AiInsight {
  summary: string;
  spreadAnalysis: string;
  targetStrategy: string;
  recommendations: AiRecommendation[];
  riskLevel: RiskLevel;
  disclaimer: string;
}

export interface AiInsightResponse {
  insight: AiInsight;
  source: 'gemini' | 'rule-based';
  model: string | null;
  cached: boolean;
  generatedAt: string;
  /** Alasan fallback ke rule-based (bila ada). */
  notice?: string;
}

export interface AiInsightRequest extends CalculationInput {
  symbol: string;
  assetName: string;
  recordDate: string;
  recordId?: string;
  force?: boolean;
  forecast?: Pick<
    ForecastResult,
    'method' | 'annualizedReturnPct' | 'annualizedVolatilityPct' | 'targetHitMonth'
  > & { months: number; finalBase: number; finalBull: number; finalBear: number };
}

export interface HealthStatus {
  status: 'ok';
  database: boolean;
  geminiConfigured: boolean;
  geminiModel: string;
  time: string;
}

