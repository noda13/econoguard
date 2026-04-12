import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import Parser from 'rss-parser';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../frontend/public/data');
mkdirSync(DATA_DIR, { recursive: true });

// --- Types ---
interface NewsArticle {
  id: string;
  source: string;
  originalTitle: string;
  originalUrl: string;
  publishedAt: string;
  summaryJa: string;
  relevanceScore: number;
  riskCategories: string[];
}

interface EconomicIndicator {
  code: string;
  name: string;
  value: number;
  previousValue: number | null;
  unit: string;
  source: string;
  recordedAt: string;
}

interface RiskAssessment {
  category: string;
  score: number;
  level: string;
  summaryJa: string;
  factorsJa: string[];
  assessedAt: string;
}

interface CompositeRisk {
  compositeScore: number;
  level: string;
  breakdown: Array<{ category: string; score: number; weight: number }>;
}

// --- Helpers ---
function readJson<T>(filename: string, fallback: T): T {
  try { return JSON.parse(readFileSync(resolve(DATA_DIR, filename), 'utf-8')); } catch { return fallback; }
}

function writeJson(filename: string, data: unknown) {
  writeFileSync(resolve(DATA_DIR, filename), JSON.stringify(data, null, 2));
}

function genId(url: string, title: string): string {
  return crypto.createHash('sha256').update(`${url}:${title}`).digest('hex').slice(0, 16);
}

function scoreToLevel(s: number): string {
  if (s <= 20) return 'low'; if (s <= 40) return 'moderate'; if (s <= 60) return 'elevated'; if (s <= 80) return 'high'; return 'critical';
}

// --- News ---
const RSS_SOURCES = [
  // 日本語ソース
  { url: 'https://www.nhk.or.jp/rss/news/cat5.xml', source: 'nhk' },
  { url: 'https://www.boj.or.jp/rss/whatsnew.xml', source: 'boj' },
  { url: 'https://assets.wor.jp/rss/rdf/nikkei/news.rdf', source: 'nikkei' },
  // 海外ソース
  { url: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtcGhHZ0pLVUNnQVAB', source: 'google_biz' },
  { url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114', source: 'cnbc' },
  { url: 'https://feeds.bloomberg.com/markets/news.rss', source: 'bloomberg' },
  { url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', source: 'marketwatch' },
  { url: 'https://www.ft.com/rss/home', source: 'ft' },
  // 国際機関
  { url: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNREpmTjNRU0FtcGhHZ0pLVUNnQVAB', source: 'google_world' },
];

async function collectNews(existing: NewsArticle[]): Promise<NewsArticle[]> {
  const parser = new Parser({ timeout: 10000, headers: { 'User-Agent': 'Econoguard/1.0' } });
  const ids = new Set(existing.map(a => a.id));
  const fresh: NewsArticle[] = [];

  for (const src of RSS_SOURCES) {
    try {
      const feed = await parser.parseURL(src.url);
      for (const item of feed.items || []) {
        if (!item.title || !item.link) continue;
        const id = genId(item.link, item.title);
        if (ids.has(id)) continue;
        fresh.push({
          id, source: src.source, originalTitle: item.title, originalUrl: item.link,
          publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
          summaryJa: '', relevanceScore: 0, riskCategories: [],
        });
      }
      console.log(`  ${src.source}: ${feed.items?.length || 0} items`);
    } catch (e) { console.error(`  ${src.source}: failed -`, e instanceof Error ? e.message : e); }
  }

  const all = [...fresh, ...existing];
  all.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  return all.slice(0, 200);
}

// --- Indicators ---
async function fetchPrice(ids: string): Promise<Record<string, Record<string, number>> | null> {
  try {
    const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd,jpy`, { headers: { 'User-Agent': 'Econoguard/1.0' } });
    return r.ok ? await r.json() as Record<string, Record<string, number>> : null;
  } catch { return null; }
}

async function collectIndicators(prev: EconomicIndicator[]): Promise<EconomicIndicator[]> {
  const pMap = new Map(prev.map(i => [i.code, i]));
  const now = new Date().toISOString();
  const result: EconomicIndicator[] = [];

  const prices = await fetchPrice('bitcoin,ethereum,tether-gold,tether');
  if (prices) {
    if (prices.bitcoin?.usd) result.push({ code: 'BTC', name: 'ビットコイン', value: prices.bitcoin.usd, previousValue: pMap.get('BTC')?.value ?? null, unit: 'USD', source: 'coingecko', recordedAt: now });
    if (prices.ethereum?.usd) result.push({ code: 'ETH', name: 'イーサリアム', value: prices.ethereum.usd, previousValue: pMap.get('ETH')?.value ?? null, unit: 'USD', source: 'coingecko', recordedAt: now });
    if (prices['tether-gold']?.usd) result.push({ code: 'GOLD', name: '金価格', value: prices['tether-gold'].usd, previousValue: pMap.get('GOLD')?.value ?? null, unit: 'USD/oz', source: 'coingecko', recordedAt: now });
    if (prices.tether?.jpy) result.push({ code: 'USDJPY', name: 'ドル円', value: prices.tether.jpy, previousValue: pMap.get('USDJPY')?.value ?? null, unit: '円', source: 'coingecko', recordedAt: now });
  }

  for (const p of prev) { if (!result.some(r => r.code === p.code)) result.push(p); }
  return result;
}

// --- Gemini ---
async function callGemini(system: string, user: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('No GEMINI_API_KEY');
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const model = new GoogleGenerativeAI(key).getGenerativeModel({ model: 'gemini-2.0-flash', systemInstruction: system });
  const r = await model.generateContent(user);
  return r.response.text();
}

function parseJson(text: string): unknown {
  let s = text.trim();
  if (s.startsWith('```')) s = s.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(s);
}

async function summarize(articles: NewsArticle[]) {
  const todo = articles.filter(a => !a.summaryJa);
  if (!todo.length) return;

  const SYS = `経済ニュースを分析し、JSON配列で応答してください。各記事: summaryJa(日本語2-3文), relevanceScore(0-1), riskCategories(["currency_finance","geopolitics_supply_chain","technology","social_policy"]から選択)。JSON配列のみ出力: [{"index":0,"summaryJa":"...","relevanceScore":0.8,"riskCategories":[...]}]`;

  for (let i = 0; i < Math.min(todo.length, 50); i += 10) {
    const batch = todo.slice(i, i + 10);
    const msg = batch.map((a, j) => `[${j}] ${a.source}: ${a.originalTitle}`).join('\n');
    try {
      const res = parseJson(await callGemini(SYS, msg)) as Array<{ index: number; summaryJa: string; relevanceScore: number; riskCategories: string[] }>;
      for (const r of res) { if (batch[r.index]) { batch[r.index].summaryJa = r.summaryJa; batch[r.index].relevanceScore = r.relevanceScore; batch[r.index].riskCategories = r.riskCategories; } }
      console.log(`  Batch ${Math.floor(i / 10) + 1} done`);
    } catch (e) { console.error('  Summarize failed:', e instanceof Error ? e.message : e); }
    if (i + 10 < todo.length) await new Promise(r => setTimeout(r, 1000));
  }
}

async function assess(news: NewsArticle[], indicators: EconomicIndicator[], prev: RiskAssessment[]): Promise<RiskAssessment[]> {
  const SYS = `グローバル経済リスクアナリスト。4カテゴリ(currency_finance, geopolitics_supply_chain, technology, social_policy)を0-100で評価。JSONのみ: {"assessments":[{"category":"...","score":65,"summary":"日本語概要","factors":["因子1","因子2"]}]}`;

  let ctx = '## ニュース\n';
  for (const a of news.filter(a => a.summaryJa).slice(0, 20)) ctx += `- [${a.source}] ${a.summaryJa}\n`;
  ctx += '\n## 指標\n';
  for (const i of indicators) ctx += `- ${i.name}: ${i.value}${i.unit}${i.previousValue ? ` (前回:${i.previousValue})` : ''}\n`;
  if (prev.length) { ctx += '\n## 前回\n'; for (const r of prev) ctx += `- ${r.category}: ${r.score}\n`; }

  const res = parseJson(await callGemini(SYS, ctx)) as { assessments: Array<{ category: string; score: number; summary: string; factors: string[] }> };
  const now = new Date().toISOString();
  return res.assessments.map(a => ({ category: a.category, score: a.score, level: scoreToLevel(a.score), summaryJa: a.summary, factorsJa: a.factors, assessedAt: now }));
}

// --- Main ---
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
  if (process.env.GEMINI_API_KEY) {
    console.log('--- Gemini: Summarize ---');
    await summarize(news);
    console.log('--- Gemini: Risk Assessment ---');
    try {
      risks = await assess(news, indicators, prevRisks);
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90);
      for (const r of risks) {
        if (!riskHistory[r.category]) riskHistory[r.category] = [];
        riskHistory[r.category].push(r);
        riskHistory[r.category] = riskHistory[r.category].filter(h => new Date(h.assessedAt) > cutoff);
      }
    } catch (e) { console.error('Assessment failed:', e instanceof Error ? e.message : e); }
  } else {
    console.log('GEMINI_API_KEY not set, skipping LLM\n');
  }

  const weights: Record<string, number> = { currency_finance: 0.3, geopolitics_supply_chain: 0.3, technology: 0.2, social_policy: 0.2 };
  const compositeScore = Math.round(risks.reduce((s, r) => s + r.score * (weights[r.category] || 0.25), 0));
  const composite: CompositeRisk = {
    compositeScore, level: scoreToLevel(compositeScore),
    breakdown: risks.map(r => ({ category: r.category, score: r.score, weight: weights[r.category] || 0.25 })),
  };

  writeJson('news.json', news);
  writeJson('indicators.json', indicators);
  writeJson('risks.json', risks);
  writeJson('composite-risk.json', composite);
  writeJson('risk-history.json', riskHistory);
  writeJson('meta.json', { lastUpdated: new Date().toISOString() });

  console.log('=== Saved to frontend/public/data/ ===');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
