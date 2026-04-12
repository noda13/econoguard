import prisma from '../lib/prisma.js';
import { callLLM, isConfigured } from './llm.js';
import { scoreToLevel } from '../schemas/api.js';

const SYSTEM_PROMPT = `あなたはグローバル経済リスクアナリストです。提供されたニュース要約と経済指標データに基づき、以下の4つのリスクカテゴリについて評価を行ってください。

## リスクカテゴリ

1. **currency_finance（通貨・金融リスク）**: 通貨変動、金利動向、インフレ、銀行セクターストレス、債務問題、CBDC動向
2. **geopolitics_supply_chain（地政学・サプライチェーン）**: 貿易戦争、経済制裁、軍事紛争、エネルギー安全保障、食料安全保障、物流混乱
3. **technology（テクノロジーリスク）**: AI規制・破壊、サイバー攻撃、半導体供給、デジタル通貨規制、テック企業リスク
4. **social_policy（社会・政策リスク）**: 中央銀行政策、財政政策変更、社会不安、人口動態変化、選挙・政権交代

## スコアリング基準
- 0-20: 低リスク（平常時、大きな懸念なし）
- 21-40: 中程度（注意すべき動きあり）
- 41-60: やや高い（具体的なリスク要因が顕在化）
- 61-80: 高い（複数のリスク要因が重なり、影響が拡大中）
- 81-100: 危機的（重大な危機が進行中）

前回のスコアが提供されている場合、急激な変動（±15以上）には明確な根拠を持たせてください。

必ず以下のJSON形式で応答してください（余計な説明は不要）:
{
  "assessments": [
    {
      "category": "currency_finance",
      "score": 65,
      "summary": "日本語での2-3文のリスク概要",
      "factors": ["寄与因子1", "寄与因子2", "寄与因子3"]
    },
    {
      "category": "geopolitics_supply_chain",
      "score": 70,
      "summary": "...",
      "factors": ["...", "...", "..."]
    },
    {
      "category": "technology",
      "score": 45,
      "summary": "...",
      "factors": ["...", "...", "..."]
    },
    {
      "category": "social_policy",
      "score": 40,
      "summary": "...",
      "factors": ["...", "...", "..."]
    }
  ]
}`;

interface RiskAssessmentInput {
  assessments: Array<{
    category: string;
    score: number;
    summary: string;
    factors: string[];
  }>;
}

async function buildContext(): Promise<string> {
  // Get recent summarized news
  const recentNews = await prisma.newsArticle.findMany({
    where: {
      summaryJa: { not: '' },
    },
    orderBy: { publishedAt: 'desc' },
    take: 30,
    select: {
      source: true,
      originalTitle: true,
      summaryJa: true,
      riskCategories: true,
      publishedAt: true,
    },
  });

  // Get latest indicators
  const indicatorCodes = ['VIX', 'USDJPY', 'US_CPI', 'US_FFR', 'GOLD', 'US10Y', 'BTC', 'ETH'];
  const indicators = await Promise.all(
    indicatorCodes.map((code) =>
      prisma.economicIndicator.findFirst({
        where: { code },
        orderBy: { recordedAt: 'desc' },
      })
    )
  );

  // Get previous risk scores
  const categories = ['currency_finance', 'geopolitics_supply_chain', 'technology', 'social_policy'];
  const previousScores = await Promise.all(
    categories.map((category) =>
      prisma.riskAssessment.findFirst({
        where: { category },
        orderBy: { assessedAt: 'desc' },
      })
    )
  );

  // Build context string
  let context = '## 最新ニュース要約\n\n';
  for (const article of recentNews) {
    const cats = JSON.parse(article.riskCategories || '[]');
    context += `- [${article.source}] ${article.summaryJa} (カテゴリ: ${cats.join(', ')})\n`;
  }

  context += '\n## 経済指標\n\n';
  for (const ind of indicators.filter(Boolean)) {
    if (!ind) continue;
    const change = ind.previousValue
      ? ` (前回: ${ind.previousValue}${ind.unit})`
      : '';
    context += `- ${ind.name}: ${ind.value}${ind.unit}${change}\n`;
  }

  context += '\n## 前回のリスクスコア\n\n';
  for (const prev of previousScores.filter(Boolean)) {
    if (!prev) continue;
    context += `- ${prev.category}: ${prev.score}/100 (${prev.level})\n`;
  }

  return context;
}

export async function assessRisks(): Promise<{ assessed: boolean }> {
  if (!isConfigured()) {
    console.log('No LLM provider configured, skipping risk assessment');
    return { assessed: false };
  }

  console.log('Building risk assessment context...');
  const context = await buildContext();

  console.log('Calling LLM for risk assessment...');
  const { text, usage } = await callLLM(SYSTEM_PROMPT, context);
  console.log(`  LLM tokens: ${usage.inputTokens} in, ${usage.outputTokens} out`);

  // Parse JSON response - handle markdown code blocks
  let jsonStr = text.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const result: RiskAssessmentInput = JSON.parse(jsonStr);
  const now = new Date();

  for (const assessment of result.assessments) {
    const level = scoreToLevel(assessment.score);

    await prisma.riskAssessment.create({
      data: {
        category: assessment.category,
        score: assessment.score,
        level,
        summaryJa: assessment.summary,
        factorsJa: JSON.stringify(assessment.factors),
        assessedAt: now,
      },
    });

    console.log(`  ${assessment.category}: ${assessment.score}/100 (${level})`);
  }

  console.log('Risk assessment complete');
  return { assessed: true };
}
