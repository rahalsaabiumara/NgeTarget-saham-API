import type { StockListItem } from '@portocalc/shared';

/** Simbol khusus: harga emas spot dunia dikonversi ke Rupiah per gram (GC=F × USDIDR ÷ 31,1035). */
export const GOLD_IDR_GRAM_SYMBOL = 'XAU-IDR';

/**
 * Daftar kurasi saham populer Bursa Efek Indonesia (suffix `.JK` di Yahoo Finance).
 * Pengguna tetap dapat mengetik ticker IDX lain secara bebas (mis. "PTBA" → "PTBA.JK").
 */
export const IDX_STOCKS: StockListItem[] = [
  { symbol: 'HRTA.JK', name: 'Hartadinata Abadi Tbk', sector: 'Emas & Perhiasan', category: 'saham' },
  { symbol: 'ANTM.JK', name: 'Aneka Tambang Tbk', sector: 'Pertambangan Emas & Nikel', category: 'saham' },
  { symbol: 'MDKA.JK', name: 'Merdeka Copper Gold Tbk', sector: 'Pertambangan Emas & Tembaga', category: 'saham' },
  { symbol: 'BRMS.JK', name: 'Bumi Resources Minerals Tbk', sector: 'Pertambangan Emas', category: 'saham' },
  { symbol: 'PSAB.JK', name: 'J Resources Asia Pasifik Tbk', sector: 'Pertambangan Emas', category: 'saham' },
  { symbol: 'BBCA.JK', name: 'Bank Central Asia Tbk', sector: 'Perbankan', category: 'saham' },
  { symbol: 'BBRI.JK', name: 'Bank Rakyat Indonesia Tbk', sector: 'Perbankan', category: 'saham' },
  { symbol: 'BMRI.JK', name: 'Bank Mandiri Tbk', sector: 'Perbankan', category: 'saham' },
  { symbol: 'BBNI.JK', name: 'Bank Negara Indonesia Tbk', sector: 'Perbankan', category: 'saham' },
  { symbol: 'BRIS.JK', name: 'Bank Syariah Indonesia Tbk', sector: 'Perbankan Syariah', category: 'saham' },
  { symbol: 'TLKM.JK', name: 'Telkom Indonesia Tbk', sector: 'Telekomunikasi', category: 'saham' },
  { symbol: 'ISAT.JK', name: 'Indosat Ooredoo Hutchison Tbk', sector: 'Telekomunikasi', category: 'saham' },
  { symbol: 'ASII.JK', name: 'Astra International Tbk', sector: 'Otomotif & Konglomerasi', category: 'saham' },
  { symbol: 'UNVR.JK', name: 'Unilever Indonesia Tbk', sector: 'Barang Konsumsi', category: 'saham' },
  { symbol: 'ICBP.JK', name: 'Indofood CBP Sukses Makmur Tbk', sector: 'Barang Konsumsi', category: 'saham' },
  { symbol: 'INDF.JK', name: 'Indofood Sukses Makmur Tbk', sector: 'Barang Konsumsi', category: 'saham' },
  { symbol: 'ADRO.JK', name: 'Alamtri Resources Indonesia Tbk', sector: 'Energi & Batu Bara', category: 'saham' },
  { symbol: 'PTBA.JK', name: 'Bukit Asam Tbk', sector: 'Energi & Batu Bara', category: 'saham' },
  { symbol: 'ITMG.JK', name: 'Indo Tambangraya Megah Tbk', sector: 'Energi & Batu Bara', category: 'saham' },
  { symbol: 'PGAS.JK', name: 'Perusahaan Gas Negara Tbk', sector: 'Energi & Gas', category: 'saham' },
  { symbol: 'INCO.JK', name: 'Vale Indonesia Tbk', sector: 'Pertambangan Nikel', category: 'saham' },
  { symbol: 'GOTO.JK', name: 'GoTo Gojek Tokopedia Tbk', sector: 'Teknologi', category: 'saham' },
  { symbol: 'KLBF.JK', name: 'Kalbe Farma Tbk', sector: 'Kesehatan & Farmasi', category: 'saham' },
  { symbol: 'CPIN.JK', name: 'Charoen Pokphand Indonesia Tbk', sector: 'Pakan & Peternakan', category: 'saham' },
  { symbol: 'SMGR.JK', name: 'Semen Indonesia Tbk', sector: 'Bahan Bangunan', category: 'saham' },
  { symbol: 'AMRT.JK', name: 'Sumber Alfaria Trijaya Tbk', sector: 'Ritel', category: 'saham' },
  { symbol: GOLD_IDR_GRAM_SYMBOL, name: 'Emas Spot Dunia (Rp per gram)', sector: 'Komoditas Emas', category: 'emas' },
];

/** Normalisasi input ticker: "hrta" → "HRTA.JK", simbol yang sudah lengkap dibiarkan. */
export function normalizeSymbol(raw: string): string {
  const s = raw.trim().toUpperCase();
  if (!s) return s;
  if (s === GOLD_IDR_GRAM_SYMBOL || s.includes('.') || s.includes('=') || s.startsWith('^')) return s;
  if (/^[A-Z]{4}$/.test(s)) return `${s}.JK`;
  return s;
}

