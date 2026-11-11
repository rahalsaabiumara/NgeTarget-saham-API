import { env, isGeminiConfigured } from './config/env';
import { createApp } from './app';
import { prisma } from './lib/prisma';
import { ensureSeedData } from './services/portfolio';

async function main() {
  const seeded = await ensureSeedData();
  if (seeded) console.log('[db] Database kosong — baris contoh HRTA ditambahkan.');

  const server = createApp().listen(env.port, () => {
    console.log(`[api] NgeTarget Saham berjalan di http://localhost:${env.port}`);
    console.log(
      `[api] Gemini AI: ${isGeminiConfigured() ? `aktif (${env.geminiModel})` : 'belum dikonfigurasi — memakai insight rule-based'}`,
    );
  });

  const shutdown = async () => {
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(async (err) => {
  console.error('[api] Gagal start:', err);
  await prisma.$disconnect();
  process.exit(1);
});

