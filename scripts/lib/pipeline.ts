import { readJson, writeJsonBatch } from './io.js';
import { detectProvider } from './llm.js';
import { collectNews, nextSeenIds, selectPublishedNews } from './news.js';
import { collectIndicators } from './indicators.js';
import { summarize } from './summarize.js';
import { assess, mergeRisks } from './assess.js';
import { computeComposite } from './composite.js';
import { selectUpcomingEvents } from './events.js';
import { checkEventCoverage } from '../economic-events.js';
import { updateRiskHistory } from './risk-history.js';
import type { CompositeRisk, EconomicIndicator, NewsArticle, RiskAssessment } from './types.js';

const isArray = (v: unknown) => Array.isArray(v);
const isRecord = (v: unknown) => typeof v === 'object' && v !== null && !Array.isArray(v);

interface Meta {
  lastUpdated?: string;
  lastCollectedAt?: string;
}

export async function runCollection(now: Date = new Date()): Promise<void> {
  console.log('=== Econoguard Static Collection ===\n');

  const coverageWarning = checkEventCoverage(now);
  if (coverageWarning) console.warn(`[economic-events] ${coverageWarning}`);

  const prevNews = readJson<NewsArticle[]>('news.json', [], isArray);
  const seenIds = readJson<string[]>('seen-ids.json', [], isArray);
  const prevIndicators = readJson<EconomicIndicator[]>('indicators.json', [], isArray);
  const prevRisks = readJson<RiskAssessment[]>('risks.json', [], isArray);
  const riskHistory = readJson<Record<string, RiskAssessment[]>>('risk-history.json', {}, isRecord);
  const prevComposite = readJson<CompositeRisk | null>('composite-risk.json', null, isRecord);
  const prevMeta = readJson<Meta>('meta.json', {}, isRecord);

  console.log('--- News ---');
  const news = await collectNews(prevNews, seenIds);
  console.log(`Total: ${news.length} articles\n`);

  console.log('--- Indicators ---');
  const indicators = await collectIndicators(prevIndicators);
  console.log(`Total: ${indicators.length}\n`);

  let freshRisks: RiskAssessment[] | null = null;
  const llm = detectProvider();
  if (llm) {
    console.log(`--- LLM (${llm.provider}): Summarize ---`);
    await summarize(news);
    console.log(`\n--- LLM (${llm.provider}): Risk Assessment ---`);
    try {
      freshRisks = await assess(news, indicators, prevRisks);
      console.log('Risk assessment done');
    } catch (e) { console.error('Assessment failed:', e instanceof Error ? e.message : e); }
  } else {
    console.log('No LLM API key set (GROQ_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY or LLM_API_KEY+LLM_BASE_URL), skipping\n');
  }

  const files: Record<string, unknown> = {
    'news.json': selectPublishedNews(news),
    'seen-ids.json': nextSeenIds(seenIds, news),
    'indicators.json': indicators,
    'events.json': selectUpcomingEvents(now),
  };

  const meta: Meta = { ...prevMeta, lastCollectedAt: now.toISOString() };
  if (freshRisks) {
    const risks = mergeRisks(prevRisks, freshRisks);
    files['risks.json'] = risks;
    files['risk-history.json'] = updateRiskHistory(riskHistory, freshRisks, now);
    const composite = computeComposite(risks, prevComposite?.compositeScore ?? 0);
    if (composite) files['composite-risk.json'] = composite;
    else console.warn('Composite not updated: risk assessments do not cover every category');
    meta.lastUpdated = now.toISOString();
  } else if (!prevComposite) {
    const composite = computeComposite(prevRisks, 0);
    if (composite) files['composite-risk.json'] = composite;
  }
  files['meta.json'] = meta;

  writeJsonBatch(files);
  console.log('\n=== Saved to frontend/public/data/ ===');
}
