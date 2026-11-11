import type { PortfolioRecord as DbRecord } from '@prisma/client';
import {
  calculatePortfolio,
  type AssetValueMode,
  type PortfolioRecord,
  type PortfolioRecordInput,
} from '@portocalc/shared';
import { prisma } from '../lib/prisma';

/** Data contoh dari spreadsheet pengguna — di-seed otomatis saat database kosong. */
export const HRTA_SAMPLE: PortfolioRecordInput = {
  symbol: 'HRTA',
  assetName: 'Emas HRTA (Hartadinata)',
  buyPrice: 2_455_000,
  sellPrice: 2_375_000,
  recordDate: '2026-11-09',
  currentAssetValue: 2_072_900,
  initialCapital: 2_100_000,
  targetPct: 10,
  assetValueMode: 'manual',
  isSimulation: false,
  notes: 'Contoh dari spreadsheet referensi (input manual harga beli & buyback).',
};

/** Hitung ulang semua kolom turunan di server agar data di DB selalu konsisten. */
function toDbData(input: PortfolioRecordInput) {
  const calc = calculatePortfolio(input);
  return {
    symbol: input.symbol.trim().toUpperCase(),
    assetName: input.assetName.trim(),
    recordDate: input.recordDate,
    assetValueMode: input.assetValueMode ?? 'manual',
    units: input.units ?? null,
    isSimulation: input.isSimulation ?? false,
    notes: input.notes?.trim() || null,
    buyPrice: calc.buyPrice,
    sellPrice: calc.sellPrice,
    spreadLossPct: calc.spreadLossPct,
    currentAssetValue: calc.currentAssetValue,
    initialCapital: calc.initialCapital,
    profitLossNominal: calc.profitLossNominal,
    profitLossPct: calc.profitLossPct,
    targetPct: calc.targetPct,
    isTargetMet: calc.isTargetMet,
  };
}

/** Ubah baris DB menjadi objek API lengkap (termasuk metrik turunan seperti harga impas). */
export function serializeRecord(row: DbRecord): PortfolioRecord {
  const calc = calculatePortfolio({
    buyPrice: row.buyPrice,
    sellPrice: row.sellPrice,
    initialCapital: row.initialCapital,
    currentAssetValue: row.currentAssetValue,
    targetPct: row.targetPct,
    assetValueMode: 'manual',
  });
  return {
    ...calc,
    id: row.id,
    symbol: row.symbol,
    assetName: row.assetName,
    recordDate: row.recordDate,
    assetValueMode: row.assetValueMode as AssetValueMode,
    units: row.units,
    isSimulation: row.isSimulation,
    notes: row.notes,
    hasAiInsight: Boolean(row.aiInsightJson),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type RecordFilter = 'all' | 'actual' | 'simulation';

export async function listRecords(filter: RecordFilter = 'all') {
  const rows = await prisma.portfolioRecord.findMany({
    where: filter === 'all' ? undefined : { isSimulation: filter === 'simulation' },
    orderBy: [{ recordDate: 'desc' }, { createdAt: 'desc' }],
  });
  return rows.map(serializeRecord);
}

export async function createRecord(input: PortfolioRecordInput) {
  const row = await prisma.portfolioRecord.create({ data: toDbData(input) });
  return serializeRecord(row);
}

export async function updateRecord(id: string, input: PortfolioRecordInput) {
  // Data berubah → cache insight AI tidak lagi relevan.
  const row = await prisma.portfolioRecord.update({
    where: { id },
    data: { ...toDbData(input), aiInsightJson: null, aiInsightHash: null },
  });
  return serializeRecord(row);
}

export async function deleteRecord(id: string) {
  await prisma.portfolioRecord.delete({ where: { id } });
}

/** Seed otomatis baris contoh HRTA bila tabel masih kosong. */
export async function ensureSeedData() {
  const count = await prisma.portfolioRecord.count();
  if (count === 0) {
    await createRecord(HRTA_SAMPLE);
    return true;
  }
  return false;
}

/* --------------------------------- CSV ----------------------------------- */

const CSV_HEADERS = [
  'SAHAM/ASET',
  'NAMA',
  'BELI',
  'JUAL',
  '%RUGI',
  'TANGGAL',
  'ASET SAAT INI',
  'MODAL AWAL',
  'L/R',
  '%L/R',
  'TARGET %',
  'STATUS TARGET',
  'JENIS',
  'CATATAN',
];

function csvCell(value: unknown): string {
  const s = value == null ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Ekspor CSV (pemisah koma, desimal titik) — kompatibel dengan Google Sheets & Excel. */
export function recordsToCsv(records: PortfolioRecord[]): string {
  const lines = records.map((r) =>
    [
      r.symbol,
      r.assetName,
      r.buyPrice,
      r.sellPrice,
      r.spreadLossPct,
      r.recordDate,
      r.currentAssetValue,
      r.initialCapital,
      r.profitLossNominal,
      r.profitLossPct,
      r.targetPct,
      r.targetStatusLabel,
      r.isSimulation ? 'Simulasi' : 'Aktual',
      r.notes ?? '',
    ]
      .map(csvCell)
      .join(','),
  );
  return [CSV_HEADERS.join(','), ...lines].join('\r\n');
}
