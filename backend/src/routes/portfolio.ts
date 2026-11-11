import { Router } from 'express';
import { z } from 'zod';
import { calculatePortfolio, forecastPortfolio, simulateWhatIf } from '@portocalc/shared';
import {
  calculationInputSchema,
  forecastRequestSchema,
  portfolioRecordInputSchema,
} from '../validation/schemas';
import {
  createRecord,
  deleteRecord,
  listRecords,
  recordsToCsv,
  updateRecord,
  type RecordFilter,
} from '../services/portfolio';
import { getHistory } from '../services/marketData';

export const portfolioRouter = Router();

/** Kalkulasi instan tanpa menyimpan (mendukung simulasi angan-angan). */
portfolioRouter.post('/calculate', (req, res) => {
  const body = calculationInputSchema
    .extend({
      whatIf: z
        .object({
          priceChangePct: z.number().min(-100).max(1000).default(0),
          additionalCapital: z.number().min(0).default(0),
        })
        .optional(),
    })
    .parse(req.body);

  const result = calculatePortfolio(body);
  const whatIf = body.whatIf ? simulateWhatIf({ base: body, ...body.whatIf }) : undefined;
  res.json({ result, whatIf });
});

/** Proyeksi nilai aset masa depan (historis saham atau asumsi return). */
portfolioRouter.post('/forecast', async (req, res) => {
  const body = forecastRequestSchema.parse(req.body);
  let historicalCloses: number[] | undefined;
  let historyNotice: string | undefined;

  if (body.method === 'historical') {
    if (!body.symbol) {
      historyNotice = 'Simbol tidak tersedia — memakai asumsi return.';
    } else {
      try {
        const history = await getHistory(body.symbol, body.historyRange);
        historicalCloses = history.map((p) => p.close);
        if (historicalCloses.length < 20) {
          historyNotice = 'Data historis kurang dari 20 hari — memakai asumsi return.';
        }
      } catch (e) {
        historyNotice = `Data historis ${body.symbol} tidak tersedia (${(e as Error).message}) — memakai asumsi return.`;
      }
    }
  }

  const forecast = forecastPortfolio({
    currentAssetValue: body.currentAssetValue,
    initialCapital: body.initialCapital,
    targetPct: body.targetPct,
    months: body.months,
    monthlyContribution: body.monthlyContribution,
    annualReturnPct: body.annualReturnPct,
    annualVolatilityPct: body.annualVolatilityPct,
    historicalCloses,
    startDate: body.startDate,
  });
  res.json({ ...forecast, notice: historyNotice });
});

portfolioRouter.get('/export.csv', async (req, res) => {
  const filter = parseFilter(req.query.type);
  const csv = recordsToCsv(await listRecords(filter));
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="portofolio-${stamp}.csv"`);
  res.send(`\uFEFF${csv}`); // BOM agar Excel membaca UTF-8 dengan benar
});

portfolioRouter.get('/', async (req, res) => {
  res.json(await listRecords(parseFilter(req.query.type)));
});

portfolioRouter.post('/', async (req, res) => {
  const input = portfolioRecordInputSchema.parse(req.body);
  res.status(201).json(await createRecord(input));
});

portfolioRouter.put('/:id', async (req, res) => {
  const input = portfolioRecordInputSchema.parse(req.body);
  res.json(await updateRecord(req.params.id, input));
});

portfolioRouter.delete('/:id', async (req, res) => {
  await deleteRecord(req.params.id);
  res.status(204).end();
});

function parseFilter(value: unknown): RecordFilter {
  return value === 'actual' || value === 'simulation' ? value : 'all';
}

