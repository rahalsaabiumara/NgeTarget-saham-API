import { describe, expect, it } from 'vitest';
import {
  calculatePortfolio,
  CalculationError,
  simulateWhatIf,
  tryCalculatePortfolio,
} from './calculation';
import type { CalculationInput } from './types';

/** Baris referensi spreadsheet pengguna (HRTA, 9 November). */
const HRTA: CalculationInput = {
  buyPrice: 2_455_000,
  sellPrice: 2_375_000,
  initialCapital: 2_100_000,
  currentAssetValue: 2_072_900,
  targetPct: 10,
  assetValueMode: 'manual',
};

describe('calculatePortfolio — referensi spreadsheet HRTA', () => {
  const r = calculatePortfolio(HRTA);

  it('%RUGI (spread) = 3,26%', () => expect(r.spreadLossPct).toBe(3.26));
  it('L/R = -27.100', () => expect(r.profitLossNominal).toBe(-27_100));
  it('%L/R = -1,29%', () => expect(r.profitLossPct).toBe(-1.29));
  it('TARGET >10% = Belum Tercapai', () => {
    expect(r.isTargetMet).toBe(false);
    expect(r.targetStatusLabel).toBe('Belum Tercapai');
  });
  it('nilai target & kekurangan menuju target', () => {
    expect(r.targetAssetValue).toBe(2_310_000);
    expect(r.shortfallToTarget).toBe(237_100);
  });
  it('harga jual impas & harga jual target', () => {
    // 2.375.000 × 2.100.000 / 2.072.900 ≈ 2.406.049,5
    expect(r.breakEvenSellPrice).toBeCloseTo(2_406_049.5, 1);
    // 2.375.000 × 2.310.000 / 2.072.900 ≈ 2.646.654,4
    expect(r.requiredSellPriceForTarget).toBeCloseTo(2_646_654.4, 0);
    expect(r.requiredPriceChangePct).toBeCloseTo(11.44, 2);
  });
});

describe('calculatePortfolio — kasus lain', () => {
  it('target tercapai tepat di batas', () => {
    const r = calculatePortfolio({ ...HRTA, currentAssetValue: 2_310_000 });
    expect(r.profitLossPct).toBe(10);
    expect(r.isTargetMet).toBe(true);
    expect(r.shortfallToTarget).toBe(0);
  });

  it('mode auto tanpa unit: modal × jual / beli', () => {
    const r = calculatePortfolio({ ...HRTA, assetValueMode: 'auto', currentAssetValue: null });
    expect(r.currentAssetValue).toBeCloseTo(2_031_568.23, 1);
    expect(r.profitLossPct).toBe(-3.26);
  });

  it('mode auto dengan unit: unit × jual', () => {
    const r = calculatePortfolio({
      buyPrice: 1_000,
      sellPrice: 1_200,
      initialCapital: 100_000,
      units: 100,
      targetPct: 10,
      assetValueMode: 'auto',
    });
    expect(r.currentAssetValue).toBe(120_000);
    expect(r.profitLossPct).toBe(20);
    expect(r.isTargetMet).toBe(true);
  });

  it('menolak input tidak valid', () => {
    expect(() => calculatePortfolio({ ...HRTA, buyPrice: 0 })).toThrow(CalculationError);
    const res = tryCalculatePortfolio({ ...HRTA, initialCapital: -1, currentAssetValue: null });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors).toHaveLength(2);
  });
});

describe('simulateWhatIf', () => {
  it('tanpa perubahan = hasil awal', () => {
    const r = simulateWhatIf({ base: HRTA, priceChangePct: 0, additionalCapital: 0 });
    expect(r.profitLossNominal).toBe(-27_100);
  });

  it('harga jual naik 11,44% → target ≈ tercapai', () => {
    const r = simulateWhatIf({ base: HRTA, priceChangePct: 11.45, additionalCapital: 0 });
    expect(r.isTargetMet).toBe(true);
  });

  it('tambahan modal dibeli di harga BELI dan menanggung spread', () => {
    const r = simulateWhatIf({ base: HRTA, priceChangePct: 0, additionalCapital: 1_000_000 });
    expect(r.initialCapital).toBe(3_100_000);
    // 2.072.900 + 1.000.000 × 2.375.000/2.455.000
    expect(r.currentAssetValue).toBeCloseTo(3_040_313.44, 1);
  });
});
