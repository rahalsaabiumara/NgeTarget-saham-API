import 'dotenv/config';

/** Konfigurasi terpusat dari file `.env` backend. GEMINI_API_KEY tidak pernah dikirim ke frontend. */
export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? 'file:./dev.db',
  geminiApiKey: (process.env.GEMINI_API_KEY ?? '').trim(),
  geminiModel: (process.env.GEMINI_MODEL ?? 'gemini-3.8-flash').trim(),
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
};

export const isGeminiConfigured = () =>
  env.geminiApiKey.length > 0 && !/MASUKKAN|YOUR_API_KEY/i.test(env.geminiApiKey);
