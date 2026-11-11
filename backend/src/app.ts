import express from 'express';
import cors from 'cors';
import type { HealthStatus } from '@portocalc/shared';
import { env, isGeminiConfigured } from './config/env';
import { prisma } from './lib/prisma';
import { errorHandler } from './lib/errors';
import { stocksRouter } from './routes/stocks';
import { portfolioRouter } from './routes/portfolio';
import { aiRouter } from './routes/ai';
import { docsRouter } from './routes/docs';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/', (_req, res) => {
    res.json({
      service: 'NgeTarget Saham (PortoCalc AI) — REST API',
      version: '1.0.0',
      docs: '/api/docs',
      openApiSpec: '/api/openapi.yaml',
      health: '/api/health',
    });
  });

  app.use('/api', docsRouter);

  app.get('/api/health', async (_req, res) => {
    let database = true;
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      database = false;
    }
    const body: HealthStatus = {
      status: 'ok',
      database,
      geminiConfigured: isGeminiConfigured(),
      geminiModel: env.geminiModel,
      time: new Date().toISOString(),
    };
    res.json(body);
  });

  app.use('/api/stocks', stocksRouter);
  app.use('/api/portfolio', portfolioRouter);
  app.use('/api/ai', aiRouter);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Endpoint tidak ditemukan.' });
  });
  app.use(errorHandler);
  return app;
}

