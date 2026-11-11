import { z } from 'zod';

const money = z.number({ error: 'Harus berupa angka.' }).finite();

export const calculationInputSchema = z.object({
  buyPrice: money.positive('Harga BELI harus lebih besar dari 0.'),
  sellPrice: money.nonnegative('Harga JUAL tidak boleh negatif.'),
  initialCapital: money.positive('MODAL AWAL harus lebih besar dari 0.'),
  currentAssetValue: money.nonnegative().nullable().optional(),
  targetPct: money.min(-100).max(10_000).default(10),
  assetValueMode: z.enum(['manual', 'auto']).default('manual'),
  units: money.nonnegative().nullable().optional(),
});

export const portfolioRecordInputSchema = calculationInputSchema.extend({
  symbol: z.string().trim().min(1, 'Saham/aset wajib dipilih.').max(32),
  assetName: z.string().trim().min(1).max(120),
  recordDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format TANGGAL harus YYYY-MM-DD.'),
  isSimulation: z.boolean().default(false),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const forecastRequestSchema = z.object({
  currentAssetValue: money.nonnegative(),
  initialCapital: money.positive(),
  targetPct: money.default(10),
  months: z.number().int().min(1).max(60).default(12),
  monthlyContribution: money.nonnegative().default(0),
  method: z.enum(['historical', 'assumption']).default('historical'),
  annualReturnPct: money.min(-90).max(300).optional(),
  annualVolatilityPct: money.min(0).max(300).optional(),
  symbol: z.string().trim().max(32).optional(),
  historyRange: z.enum(['1m', '3m', '6m', '1y']).default('3m'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const aiInsightRequestSchema = calculationInputSchema.extend({
  symbol: z.string().trim().min(1).max(32),
  assetName: z.string().trim().min(1).max(120),
  recordDate: z.string().max(20),
  recordId: z.string().uuid().nullish(),
  force: z.boolean().default(false),
  forecast: z
    .object({
      method: z.enum(['historical', 'assumption']),
      months: z.number(),
      annualizedReturnPct: z.number(),
      annualizedVolatilityPct: z.number(),
      finalBase: z.number(),
      finalBull: z.number(),
      finalBear: z.number(),
      targetHitMonth: z.object({
        base: z.number().nullable(),
        bull: z.number().nullable(),
        bear: z.number().nullable(),
      }),
    })
    .optional(),
});

export type ForecastRequest = z.infer<typeof forecastRequestSchema>;
export type AiInsightRequestBody = z.infer<typeof aiInsightRequestSchema>;
