import type { AiInsight, AiRecommendation, CalculationResult, RiskLevel } from '@portocalc/shared';
import type { AiInsightRequestBody } from '../validation/schemas';

const rupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
const pct = (n: number) => `${n.toLocaleString('id-ID', { maximumFractionDigits: 2 })}%`;

export const AI_DISCLAIMER =
  'Analisis ini bersifat edukatif dan simulatif, bukan rekomendasi beli/jual. Keputusan investasi sepenuhnya tanggung jawab Anda.';

/**
 * Insight berbasis aturan — dipakai bila GEMINI_API_KEY belum diisi atau API Gemini gagal,
 * sehingga panel insight tetap berguna (NFR: aplikasi tidak boleh crash).
 */
export function buildRuleBasedInsight(req: AiInsightRequestBody, calc: CalculationResult): AiInsight {
  const name = `${req.assetName} (${req.symbol})`;
  const loss = calc.profitLossNominal < 0;
  const spreadHigh = calc.spreadLossPct >= 2.5;

  const summary = loss
    ? `Posisi ${name} saat ini floating loss ${rupiah(Math.abs(calc.profitLossNominal))} (${pct(calc.profitLossPct)}) dari modal ${rupiah(calc.initialCapital)}. Nilai aset ${rupiah(calc.currentAssetValue)} masih di bawah modal awal.`
    : `Posisi ${name} saat ini untung ${rupiah(calc.profitLossNominal)} (${pct(calc.profitLossPct)}) dari modal ${rupiah(calc.initialCapital)}, dengan nilai aset ${rupiah(calc.currentAssetValue)}.`;

  const spreadAnalysis = spreadHigh
    ? `Spread beli–jual sebesar ${pct(calc.spreadLossPct)} tergolong besar (khas emas fisik/buyback). Artinya, setiap pembelian baru langsung "tertekan" sekitar ${pct(calc.spreadLossPct)} sebelum harga naik. Instrumen seperti ini lebih cocok untuk horizon menengah–panjang.`
    : `Spread beli–jual ${pct(calc.spreadLossPct)} relatif kecil, sehingga biaya keluar-masuk posisi tidak terlalu membebani. Pergerakan harga pasar menjadi faktor dominan terhadap L/R.`;

  const targetStrategy = calc.isTargetMet
    ? `Target ${pct(calc.targetPct)} sudah TERCAPAI (nilai target ${rupiah(calc.targetAssetValue)}). Pertimbangkan untuk mengamankan sebagian keuntungan atau menaikkan target secara bertahap.`
    : `Target ${pct(calc.targetPct)} BELUM tercapai. Dibutuhkan nilai aset ${rupiah(calc.targetAssetValue)} (kurang ${rupiah(calc.shortfallToTarget)}).` +
      (calc.requiredSellPriceForTarget != null
        ? ` Secara harga, JUAL perlu naik ke sekitar ${rupiah(calc.requiredSellPriceForTarget)} (+${pct(calc.requiredPriceChangePct ?? 0)}); titik impas di harga JUAL ${rupiah(calc.breakEvenSellPrice ?? 0)}.`
        : '');

  const recs: AiRecommendation[] = [];
  if (!calc.isTargetMet && loss) {
    recs.push({
      title: 'Hold & evaluasi berkala',
      detail: `Kerugian ${pct(calc.profitLossPct)} masih dalam batas wajar fluktuasi. Pantau harga JUAL terhadap titik impas ${rupiah(calc.breakEvenSellPrice ?? 0)} sebelum mengambil keputusan.`,
    });
    recs.push({
      title: 'Average down secara terukur',
      detail: spreadHigh
        ? `Bila ingin menambah posisi, ingat spread ${pct(calc.spreadLossPct)} juga berlaku pada tambahan modal. Gunakan simulator "angan-angan" untuk menguji dampaknya sebelum membeli.`
        : 'Menambah posisi saat harga turun dapat menurunkan harga rata-rata. Batasi porsi tambahan agar risiko tetap terkendali.',
    });
  } else if (!calc.isTargetMet) {
    recs.push({
      title: 'Lanjutkan menuju target',
      detail: `Posisi sudah profit namun masih kurang ${rupiah(calc.shortfallToTarget)} menuju target. Pertimbangkan trailing stop agar keuntungan yang ada tetap terlindungi.`,
    });
  } else {
    recs.push({
      title: 'Amankan sebagian keuntungan',
      detail: 'Realisasikan sebagian profit (mis. 30–50%) dan biarkan sisanya berjalan untuk menangkap potensi kenaikan lanjutan.',
    });
  }

  if (req.forecast) {
    const f = req.forecast;
    const hit = f.targetHitMonth.base;
    recs.push({
      title: 'Bacaan proyeksi',
      detail:
        hit != null
          ? `Skenario moderat (return ~${pct(f.annualizedReturnPct)}/tahun) memperkirakan target tercapai sekitar bulan ke-${hit}. Skenario pesimis: ${f.targetHitMonth.bear != null ? `bulan ke-${f.targetHitMonth.bear}` : `belum tercapai dalam ${f.months} bulan`}.`
          : `Dengan asumsi return ~${pct(f.annualizedReturnPct)}/tahun, target belum tercapai dalam ${f.months} bulan (nilai moderat akhir ${rupiah(f.finalBase)}). Pertimbangkan setoran rutin (DCA) atau horizon lebih panjang.`,
    });
  }

  recs.push({
    title: 'Manajemen risiko',
    detail: 'Jangan menempatkan seluruh dana pada satu aset. Tentukan batas kerugian maksimal (cut loss) dan dana darurat terpisah dari dana investasi.',
  });

  const risk: RiskLevel =
    calc.profitLossPct <= -10 ? 'tinggi' : calc.profitLossPct < 0 || spreadHigh ? 'sedang' : 'rendah';

  return {
    summary,
    spreadAnalysis,
    targetStrategy,
    recommendations: recs,
    riskLevel: risk,
    disclaimer: AI_DISCLAIMER,
  };
}

