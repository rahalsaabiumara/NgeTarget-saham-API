import { Router } from 'express';
import { env, isGeminiConfigured } from '../config/env';
import { aiInsightRequestSchema } from '../validation/schemas';
import { generateInsight } from '../services/geminiAi';

export const aiRouter = Router();

/** Status konfigurasi Gemini (tanpa pernah membocorkan API key). */
aiRouter.get('/status', (_req, res) => {
  res.json({ geminiConfigured: isGeminiConfigured(), model: env.geminiModel });
});

aiRouter.post('/insight', async (req, res) => {
  const body = aiInsightRequestSchema.parse(req.body);
  res.json(await generateInsight(body));
});

