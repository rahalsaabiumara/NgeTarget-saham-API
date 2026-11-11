import { Router } from 'express';
import { IDX_STOCKS } from '../data/idxStocks';
import { getHistory, getQuote, searchSymbols } from '../services/marketData';

export const stocksRouter = Router();

/** Daftar kurasi saham IDX + emas spot. */
stocksRouter.get('/list', (_req, res) => {
  res.json(IDX_STOCKS);
});

stocksRouter.get('/search', async (req, res) => {
  res.json(await searchSymbols(String(req.query.q ?? '')));
});

stocksRouter.get('/quote/:symbol', async (req, res) => {
  res.json(await getQuote(req.params.symbol));
});

stocksRouter.get('/history/:symbol', async (req, res) => {
  const range = String(req.query.range ?? '3m');
  res.json(await getHistory(req.params.symbol, range));
});

