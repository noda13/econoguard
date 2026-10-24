import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { callLLM, isConfigured, parseLLMJson } from './llm.js';
import { riskCategorySchema } from '../schemas/api.js';

const BATCH_SIZE = 10;

const SYSTEM_PROMPT = `あなたはグローバル経済リスクアナリストです。与えられたニュース記事を分析し、以下のJSON形式で応答してください。

各記事について:
1. summaryJa: 日本語で2-3文の簡潔な要約（マクロ経済・金融市場への影響を中心に）
2. relevanceScore: グローバル経済リスクとの関連度（0-100の整数）。以下の基準で厳格に評価:
   - 70-100: マクロ経済に直接影響（金融政策変更、通貨危機、貿易摩擦、地政学的衝突、主要指標の大幅変動）
   - 40-69: 間接的だが無視できない影響（業界全体の規制変更、主要企業の業績が市場に波及）
   - 10-29: 影響が限定的またはローカル（個別企業人事、地方ニュース、小規模イベント）
   - 0-9: 経済リスクと無関係
3. riskCategories: 関連するリスクカテゴリの配列。以下から選択:
   - "currency_finance": 通貨・金融リスク（通貨変動、金利、インフレ、銀行危機、債務問題）
   - "geopolitics_supply_chain": 地政学・サプライチェーン（貿易戦争、制裁、紛争、エネルギー安保）
   - "technology": テクノロジーリスク（AI規制、サイバー攻撃、半導体、デジタル通貨）
   - "social_policy": 社会・政策リスク（中央銀行政策、財政政策、社会不安、人口動態）
   relevanceScoreが30未満の記事は空配列[]にしてください。

必ず以下のJSON配列形式で応答してください（余計な説明は不要）:
[
  {
    "index": 0,
    "summaryJa": "...",
    "relevanceScore": 80,
    "riskCategories": ["currency_finance", "geopolitics_supply_chain"]
  },
  ...
]`;

const summaryResultSchema = z.array(
  z.object({
    index: z.number().int(),
    summaryJa: z.string().max(1000),
    relevanceScore: z.number(),
    riskCategories: z.array(riskCategorySchema),
  })
);

async function summarizeBatch(articles: { id: number; originalTitle: string; source: string }[]): Promise<number> {
  const userMessage = articles
    .map((a, i) => `[${i}] Source: ${a.source}\nTitle: ${a.originalTitle}`)
    .join('\n\n');

  try {
    const { text, usage } = await callLLM(SYSTEM_PROMPT, userMessage);
    console.log(`  LLM tokens: ${usage.inputTokens} in, ${usage.outputTokens} out`);

    let count = 0;
    let parsed: unknown;
    try {
      parsed = parseLLMJson(text);
    } catch (parseErr) {
      console.error('Failed to parse LLM JSON response:', parseErr instanceof Error ? parseErr.message : parseErr);
      return 0;
    }

    const validation = summaryResultSchema.safeParse(parsed);
    if (!validation.success) {
      console.error('LLM response failed schema validation:', validation.error.message);
      return 0;
    }

    for (const result of validation.data) {
      const article = articles[result.index];
      if (!article) continue;

      const rawScore = result.relevanceScore;
      const relevanceScore = Number.isFinite(rawScore)
        ? Math.round(Math.max(0, Math.min(100, rawScore)))
        : 0;

      await prisma.newsArticle.update({
        where: { id: article.id },
        data: {
          summaryJa: result.summaryJa,
          relevanceScore,
          riskCategories: JSON.stringify(result.riskCategories),
        },
      });
      count++;
    }
    return count;
  } catch (error) {
    console.error('Failed to summarize batch:', error instanceof Error ? error.message : error);
    return 0;
  }
}

export async function summarizeUnsummarized(): Promise<{ summarized: number }> {
  if (!isConfigured()) {
    console.log('LLM provider unavailable, skipping summarization');
    return { summarized: 0 };
  }

  // Find articles without summaries
  const unsummarized = await prisma.newsArticle.findMany({
    where: { summaryJa: '' },
    orderBy: { publishedAt: 'desc' },
    take: 50, // Process max 50 articles per run
    select: { id: true, originalTitle: true, source: true },
  });

  if (unsummarized.length === 0) {
    console.log('No articles to summarize');
    return { summarized: 0 };
  }

  console.log(`Summarizing ${unsummarized.length} articles in batches of ${BATCH_SIZE}...`);
  let summarized = 0;

  for (let i = 0; i < unsummarized.length; i += BATCH_SIZE) {
    const batch = unsummarized.slice(i, i + BATCH_SIZE);
    console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} articles`);
    const count = await summarizeBatch(batch);
    summarized += count;

    // Small delay between batches to be nice to the API
    if (i + BATCH_SIZE < unsummarized.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.log(`Summarization complete: ${summarized} articles processed`);
  return { summarized };
}
