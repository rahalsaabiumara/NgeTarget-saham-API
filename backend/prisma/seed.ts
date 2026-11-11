/**
 * Seed manual: `npm run db:seed -w backend`
 * Menambahkan baris contoh HRTA dari spreadsheet referensi bila belum ada.
 */
import { prisma } from '../src/lib/prisma';
import { createRecord, HRTA_SAMPLE } from '../src/services/portfolio';

async function main() {
  const exists = await prisma.portfolioRecord.findFirst({
    where: { symbol: HRTA_SAMPLE.symbol, recordDate: HRTA_SAMPLE.recordDate },
  });
  if (exists) {
    console.log('Baris contoh HRTA sudah ada — dilewati.');
    return;
  }
  const record = await createRecord(HRTA_SAMPLE);
  console.log('Seed berhasil:', record.symbol, record.recordDate, record.targetStatusLabel);
}

main().finally(() => prisma.$disconnect());

