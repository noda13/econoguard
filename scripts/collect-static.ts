import { readJson, writeJson } from './lib/io.js';
import { detectProvider } from './lib/llm.js';
import { collectNews } from './lib/news.js';
import { collectIndicators } from './lib/indicators.js';
import { summarize } from './lib/summarize.js';
import { assess } from './lib/assess.js';
import { computeComposite } from './lib/composite.js';
import { selectUpcomingEvents } from './lib/events.js';
import type { CompositeRisk, EconomicIndicator, NewsArticle, RiskAssessment } from './lib/types.js';

async function main() {
  console.log('=== Econoguard Static Collection ===\n');

  const prevNews = readJson<NewsArticle[]>('news.json', []);
  const prevIndicators = readJson<EconomicIndicator[]>('indicators.json', []);
  const prevRisks = readJson<RiskAssessment[]>('risks.json', []);
  const riskHistory = readJson<Record<string, RiskAssessment[]>>('risk-history.json', {});

  console.log('--- News ---');
  const news = await collectNews(prevNews);
  console.log(`Total: ${news.length} articles\n`);

  console.log('--- Indicators ---');
  const indicators = await collectIndicators(prevIndicators);
  console.log(`Total: ${indicators.length}\n`);

  let risks = prevRisks;
  const llm = detectProvider();
  if (llm) {
    console.log(`--- LLM (${llm.provider}): Summarize ---`);
    await summarize(news);
    console.log(`\n--- LLM (${llm.provider}): Risk Assessment ---`);
    try {
      risks = await assess(news, indicators, prevRisks);
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90);
      for (const r of risks) {
        if (!riskHistory[r.category]) riskHistory[r.category] = [];
        riskHistory[r.category].push(r);
        riskHistory[r.category] = riskHistory[r.category].filter(h => new Date(h.assessedAt) > cutoff);
      }
      console.log('Risk assessment done');
    } catch (e) { console.error('Assessment failed:', e instanceof Error ? e.message : e); }
  } else {
    console.log('No LLM API key set (GROQ_API_KEY or GEMINI_API_KEY), skipping\n');
  }

  const prevComposite = readJson<CompositeRisk>('composite-risk.json', { compositeScore: 0, level: 'low', breakdown: [] });
  const composite = computeComposite(risks, prevComposite.compositeScore);

  // Keep not-yet-summarized articles so they aren't dropped before the next LLM run can score them.
  const filteredNews = news
    .filter(a => !a.summaryJa || a.relevanceScore >= 30)
    .slice(0, 200);
  writeJson('news.json', filteredNews);
  writeJson('indicators.json', indicators);
  writeJson('risks.json', risks);
  writeJson('composite-risk.json', composite);
  writeJson('risk-history.json', riskHistory);
  writeJson('meta.json', { lastUpdated: new Date().toISOString() });
  writeJson('events.json', selectUpcomingEvents(new Date()));

  console.log('\n=== Saved to frontend/public/data/ ===');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
