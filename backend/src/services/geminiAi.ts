import { createHash } from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import {
  calculatePortfolio,
  type AiInsight,
  type AiInsightResponse,
  type CalculationResult,
} from '@portocalc/shared';
import { env, isGeminiConfigured } from '../config/env';
import { prisma } from '../lib/prisma';
import type { AiInsightRequestBody } from '../validation/schemas';
import { AI_DISCLAIMER, buildRuleBasedInsight } from './ruleBasedInsight';

let client: GoogleGenAI | null = null;
function getClient() {
  if (!client) client = new GoogleGenAI({ apiKey: env.geminiApiKey });
  return client;
}

/** Skema JSON output agar respons Gemini selalu terstruktur. */
const INSIGHT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'Diagnosis singkat kondisi posisi saat ini (2-3 kalimat).' },
    spreadAnalysis: { type: 'string', description: 'Analisis dampak spread %RUGI antara harga beli & jual.' },
    targetStrategy: {
      type: 'string',
      description: 'Jarak menuju target, kenaikan harga yang dibutuhkan, dan estimasi waktu bila ada proyeksi.',
    },
    recommendations: {
      type: 'array',
      minItems: 2,
      maxItems: 5,
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Judul saran singkat (maks 6 kata).' },
          detail: { type: 'string', description: 'Penjelasan saran yang konkret dan terukur.' },
        },
        required: ['title', 'detail'],
      },
    },
    riskLevel: { type: 'string', enum: ['rendah', 'sedang', 'tinggi'] },
  },
  required: ['summary', 'spreadAnalysis', 'targetStrategy', 'recommendations', 'riskLevel'],
};

const SYSTEM_INSTRUCTION = `Anda adalah asisten analis portofolio investasi pribadi untuk investor ritel Indonesia.
Jawab dalam Bahasa Indonesia yang ringkas, jelas, dan ramah. Gunakan format Rupiah (contoh: Rp 2.100.000) dan persen dengan koma desimal (contoh: -1,29%).
Dasarkan analisis HANYA pada angka yang diberikan; jangan mengarang data pasar, berita, atau harga yang tidak disediakan.
Jangan memberi perintah beli/jual yang pasti — berikan opsi strategi beserta pertimbangan risikonya.`;

function buildPrompt(req: AiInsightRequestBody, calc: CalculationResult): string {
  const lines = [
    `Aset: ${req.assetName} (${req.symbol}) — tanggal pencatatan ${req.recordDate}`,
    `BELI (harga beli per unit): ${calc.buyPrice}`,
    `JUAL (harga jual/buyback per unit): ${calc.sellPrice}`,
    `%RUGI (spread beli-jual): ${calc.spreadLossPct}%`,
    `MODAL AWAL: ${calc.initialCapital}`,
    `ASET SAAT INI: ${calc.currentAssetValue}`,
    `L/R: ${calc.profitLossNominal}`,
    `%L/R: ${calc.profitLossPct}%`,
    `TARGET: ${calc.targetPct}% → status ${calc.targetStatusLabel}`,
    `Nilai aset untuk mencapai target: ${calc.targetAssetValue} (kekurangan ${calc.shortfallToTarget})`,
    `Harga JUAL impas: ${calc.breakEvenSellPrice ?? '-'}`,
    `Harga JUAL untuk target: ${calc.requiredSellPriceForTarget ?? '-'} (perubahan ${calc.requiredPriceChangePct ?? '-'}%)`,
  ];
  if (req.forecast) {
    const f = req.forecast;
    lines.push(
      `Proyeksi ${f.months} bulan (metode ${f.method === 'historical' ? 'tren historis' : 'asumsi return'}):`,
      `- return tahunan ~${f.annualizedReturnPct}%, volatilitas tahunan ~${f.annualizedVolatilityPct}%`,
      `- nilai akhir: pesimis ${f.finalBear}, moderat ${f.finalBase}, optimis ${f.finalBull}`,
      `- bulan target tercapai: pesimis ${f.targetHitMonth.bear ?? 'tidak tercapai'}, moderat ${f.targetHitMonth.base ?? 'tidak tercapai'}, optimis ${f.targetHitMonth.bull ?? 'tidak tercapai'}`,
    );
  }
  return `Analisis data portofolio berikut dan berikan insight serta saran:\n${lines.join('\n')}`;
}

function inputHash(req: AiInsightRequestBody): string {
  const { force: _force, recordId: _recordId, ...rest } = req;
  return createHash('sha256').update(JSON.stringify(rest)).digest('hex').slice(0, 32);
}

function parseInsight(text: string | undefined): AiInsight {
  if (!text) throw new Error('Respons Gemini kosong.');
  const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, '');
  const raw = JSON.parse(cleaned) as Partial<AiInsight>;
  if (!raw.summary || !Array.isArray(raw.recommendations)) {
    throw new Error('Format respons Gemini tidak sesuai skema.');
  }
  return {
    summary: raw.summary,
    spreadAnalysis: raw.spreadAnalysis ?? '',
    targetStrategy: raw.targetStrategy ?? '',
    recommendations: raw.recommendations.filter((r) => r?.title && r?.detail),
    riskLevel: raw.riskLevel === 'rendah' || raw.riskLevel === 'tinggi' ? raw.riskLevel : 'sedang',
    disclaimer: AI_DISCLAIMER,
  };
}

/**
 * Hasilkan insight portofolio. Urutan: cache SQLite (bila input sama) → Gemini → fallback rule-based.
 */
export async function generateInsight(req: AiInsightRequestBody): Promise<AiInsightResponse> {
  const calc = calculatePortfolio(req);
  const hash = inputHash(req);

  if (req.recordId && !req.force) {
    const row = await prisma.portfolioRecord.findUnique({ where: { id: req.recordId } });
    if (row?.aiInsightJson && row.aiInsightHash === hash) {
      return { ...(JSON.parse(row.aiInsightJson) as AiInsightResponse), cached: true };
    }
  }

  let response: AiInsightResponse;
  if (!isGeminiConfigured()) {
    response = {
      insight: buildRuleBasedInsight(req, calc),
      source: 'rule-based',
      model: null,
      cached: false,
      generatedAt: new Date().toISOString(),
      notice: 'GEMINI_API_KEY belum diisi di backend/.env — menampilkan analisis berbasis aturan.',
    };
  } else {
    try {
      const result = await getClient().models.generateContent({
        model: env.geminiModel,
        contents: buildPrompt(req, calc),
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseJsonSchema: INSIGHT_JSON_SCHEMA,
          temperature: 0.4,
        },
      });
      response = {
        insight: parseInsight(result.text),
        source: 'gemini',
        model: env.geminiModel,
        cached: false,
        generatedAt: new Date().toISOString(),
      };
    } catch (err) {
      const message = (err as Error).message ?? String(err);
      console.warn('[gemini] gagal:', message);
      response = {
        insight: buildRuleBasedInsight(req, calc),
        source: 'rule-based',
        model: null,
        cached: false,
        generatedAt: new Date().toISOString(),
        notice: `Gemini AI tidak dapat dihubungi (${summarizeError(message)}) — menampilkan analisis berbasis aturan.`,
      };
    }
  }

  // Hanya simpan cache untuk hasil Gemini agar fallback tidak "mengunci" cache.
  if (req.recordId && response.source === 'gemini') {
    await prisma.portfolioRecord
      .update({
        where: { id: req.recordId },
        data: { aiInsightJson: JSON.stringify(response), aiInsightHash: hash },
      })
      .catch(() => undefined);
  }
  return response;
}

function summarizeError(message: string): string {
  if (/API key not valid|API_KEY_INVALID|401|403/i.test(message)) return 'API key tidak valid';
  if (/429|quota|RESOURCE_EXHAUSTED/i.test(message)) return 'kuota/rate limit terlampaui';
  if (/404|not found/i.test(message)) return `model "${env.geminiModel}" tidak ditemukan`;
  if (/fetch failed|ENOTFOUND|ECONN/i.test(message)) return 'koneksi internet bermasalah';
  return message.slice(0, 120);
}

