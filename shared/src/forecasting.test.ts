import { describe, expect, it } from 'vitest';
import {
  computeDailyStats,
  dailyToAnnualReturnPct,
  forecastPortfolio,
  ANNUAL_RETURN_CLAMP,
} from './forecasting';

const base = { currentAssetValue: 2_072_900, initialCapital: 2_100_000, targetPct: 10 };

describe('computeDailyStats', () => {
  it('menghitung drift dan volatilitas', () => {
    const s = computeDailyStats([100, 110, 99, 108.9]);
    expect(s.sampleSize).toBe(3);
    expect(s.drift).toBeCloseTo((0.1 - 0.1 + 0.1) / 3, 10);
    expect(s.volatility).toBeGreaterThan(0);
  });

  it('data kosong aman', () => {
    expect(computeDailyStats([])).toEqual({ drift: 0, volatility: 0, sampleSize: 0 });
  });
});

describe('forecastPortfolio', () => {
  it('metode asumsi: 12% per tahun → base bulan 12 ≈ aset × 1,12', () => {
    const f = forecastPortfolio({
      ...base,
      months: 12,
      annualReturnPct: 12,
      annualVolatilityPct: 20,
      startDate: '2026-11-09',
    });
    expect(f.method).toBe('assumption');
    expect(f.points).toHaveLength(13);
    expect(f.points[0].base).toBe(2_072_900);
    expect(f.points[12].base).toBeCloseTo(2_072_900 * 1.12, -1);
    expect(f.points[12].date).toBe('2027-11-09');
    expect(f.points[12].bull).toBeGreaterThan(f.points[12].base);
    expect(f.points[12].bear).toBeLessThan(f.points[12].base);
    expect(f.points[0].targetValue).toBe(2_310_000);
    // 2.072.900 × 1,12 = 2.321.648 ≥ 2.310.000 → target base tercapai di bulan ke-12
    expect(f.targetHitMonth.base).toBe(12);
  });

  it('setoran bulanan menambah modal disetor & target', () => {
    const f = forecastPortfolio({ ...base, months: 6, monthlyContribution: 100_000, annualReturnPct: 0 });
    expect(f.points[6].invested).toBe(2_700_000);
    expect(f.points[6].base).toBeCloseTo(2_672_900, 0);
    expect(f.points[6].targetValue).toBe(2_970_000);
  });

  it('metode historis dipakai bila data cukup & return di-clamp', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 * 1.01 ** i); // ~ +1%/hari
    const f = forecastPortfolio({ ...base, months: 3, historicalCloses: closes });
    expect(f.method).toBe('historical');
    expect(f.sampleSize).toBe(59);
    expect(f.rawAnnualizedReturnPct!).toBeGreaterThan(ANNUAL_RETURN_CLAMP.max);
    expect(f.annualizedReturnPct).toBeCloseTo(ANNUAL_RETURN_CLAMP.max, 5);
    expect(dailyToAnnualReturnPct(f.dailyDrift)).toBeCloseTo(80, 5);
  });

  it('target sudah tercapai → bulan 0', () => {
    const f = forecastPortfolio({ ...base, currentAssetValue: 2_400_000, months: 3 });
    expect(f.targetHitMonth.base).toBe(0);
  });
});

