import type { CalculationInput, CalculationResult } from './types';

export const DEFAULT_TARGET_PCT = 10;

/** Pembulatan aman ke `digits` desimal (menghindari artefak floating point). */
export function round(value: number, digits = 2): number {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Validasi input kalkulasi. Mengembalikan daftar pesan error (kosong = valid).
 */
export function validateCalculationInput(input: CalculationInput): string[] {
  const errors: string[] = [];
  const mode = input.assetValueMode ?? 'manual';

  if (!isFiniteNumber(input.buyPrice) || input.buyPrice <= 0) {
    errors.push('Harga BELI harus lebih besar dari 0.');
  }
  if (!isFiniteNumber(input.sellPrice) || input.sellPrice < 0) {
    errors.push('Harga JUAL tidak boleh negatif.');
  }
  if (!isFiniteNumber(input.initialCapital) || input.initialCapital <= 0) {
    errors.push('MODAL AWAL harus lebih besar dari 0.');
  }
  if (!isFiniteNumber(input.targetPct)) {
    errors.push('TARGET % harus berupa angka.');
  }
  if (mode === 'manual') {
    if (!isFiniteNumber(input.currentAssetValue) || (input.currentAssetValue as number) < 0) {
      errors.push('ASET SAAT INI wajib diisi dan tidak boleh negatif.');
    }
  } else if (input.units != null && (!isFiniteNumber(input.units) || input.units < 0)) {
    errors.push('Jumlah unit tidak boleh negatif.');
  }
  return errors;
}

/**
 * Menghitung nilai ASET SAAT INI sesuai mode.
 * - manual : nilai yang diketik pengguna.
 * - auto   : unit × JUAL, atau MODAL AWAL × (JUAL / BELI) bila unit kosong
 *            (asumsi seluruh modal dibelikan pada harga BELI lalu dinilai pada harga JUAL).
 */
export function resolveCurrentAssetValue(input: CalculationInput): number {
  const mode = input.assetValueMode ?? 'manual';
  if (mode === 'manual') return Number(input.currentAssetValue ?? 0);
  if (input.units != null && input.units > 0) return input.units * input.sellPrice;
  return input.buyPrice > 0 ? input.initialCapital * (input.sellPrice / input.buyPrice) : 0;
}

/**
 * Engine kalkulasi utama — mereplikasi rumus spreadsheet:
 *   %RUGI = (BELI − JUAL) / BELI × 100
 *   L/R   = ASET SAAT INI − MODAL AWAL
 *   %L/R  = L/R / MODAL AWAL × 100
 *   TARGET tercapai bila %L/R ≥ TARGET %
 */
export function calculatePortfolio(input: CalculationInput): CalculationResult {
  const errors = validateCalculationInput(input);
  if (errors.length > 0) {
    throw new CalculationError(errors);
  }

  const { buyPrice, sellPrice, initialCapital } = input;
  const targetPct = input.targetPct;
  const currentAssetValue = resolveCurrentAssetValue(input);

  const spreadLossPct = ((buyPrice - sellPrice) / buyPrice) * 100;
  const profitLossNominal = currentAssetValue - initialCapital;
  const profitLossPct = (profitLossNominal / initialCapital) * 100;
  const targetAssetValue = initialCapital * (1 + targetPct / 100);
  const isTargetMet = profitLossPct >= targetPct - 1e-9;
  const shortfallToTarget = Math.max(0, targetAssetValue - currentAssetValue);

  // Nilai aset diasumsikan bergerak proporsional terhadap harga jual.
  const canProject = currentAssetValue > 0 && sellPrice > 0;
  const breakEvenSellPrice = canProject ? sellPrice * (initialCapital / currentAssetValue) : null;
  const requiredSellPriceForTarget = canProject
    ? sellPrice * (targetAssetValue / currentAssetValue)
    : null;
  const requiredPriceChangePct =
    requiredSellPriceForTarget != null ? (requiredSellPriceForTarget / sellPrice - 1) * 100 : null;

  return {
    buyPrice: round(buyPrice),
    sellPrice: round(sellPrice),
    spreadLossPct: round(spreadLossPct),
    currentAssetValue: round(currentAssetValue),
    initialCapital: round(initialCapital),
    profitLossNominal: round(profitLossNominal),
    profitLossPct: round(profitLossPct),
    targetPct: round(targetPct),
    targetAssetValue: round(targetAssetValue),
    shortfallToTarget: round(shortfallToTarget),
    isTargetMet,
    targetStatusLabel: isTargetMet ? 'Tercapai' : 'Belum Tercapai',
    breakEvenSellPrice: breakEvenSellPrice != null ? round(breakEvenSellPrice) : null,
    requiredSellPriceForTarget:
      requiredSellPriceForTarget != null ? round(requiredSellPriceForTarget) : null,
    requiredPriceChangePct: requiredPriceChangePct != null ? round(requiredPriceChangePct) : null,
  };
}

/** Versi aman yang tidak melempar error — cocok untuk preview real-time di UI. */
export function tryCalculatePortfolio(
  input: CalculationInput,
): { ok: true; result: CalculationResult } | { ok: false; errors: string[] } {
  const errors = validateCalculationInput(input);
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, result: calculatePortfolio(input) };
}

export interface WhatIfInput {
  base: CalculationInput;
  /** Perubahan harga jual (%) — mis. 15 berarti harga jual naik 15%. */
  priceChangePct: number;
  /** Tambahan modal yang dibelikan pada harga BELI saat ini. */
  additionalCapital: number;
  /** Override target % (opsional). */
  targetPct?: number;
}

/**
 * Simulasi "angan-angan": bagaimana bila harga jual berubah X% dan modal ditambah Rp Y?
 * Tambahan modal dibelikan pada harga BELI saat ini, lalu dinilai pada harga JUAL baru.
 */
export function simulateWhatIf(input: WhatIfInput): CalculationResult {
  const base = input.base;
  const factor = 1 + input.priceChangePct / 100;
  const newSellPrice = Math.max(0, base.sellPrice * factor);
  const currentAsset = resolveCurrentAssetValue(base);
  const extra = Math.max(0, input.additionalCapital);
  const extraValue = base.buyPrice > 0 ? extra * (newSellPrice / base.buyPrice) : 0;

  return calculatePortfolio({
    buyPrice: base.buyPrice,
    sellPrice: newSellPrice,
    initialCapital: base.initialCapital + extra,
    currentAssetValue: currentAsset * factor + extraValue,
    targetPct: input.targetPct ?? base.targetPct,
    assetValueMode: 'manual',
  });
}

export class CalculationError extends Error {
  readonly errors: string[];
  constructor(errors: string[]) {
    super(errors.join(' '));
    this.name = 'CalculationError';
    this.errors = errors;
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

