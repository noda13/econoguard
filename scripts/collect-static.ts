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
  { url: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtcGhHZ0pLVUNnQVAB', source: 'google_biz' },
  // 海外メディア
  { url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114', source: 'cnbc' },
  { url: 'https://feeds.bloomberg.com/markets/news.rss', source: 'bloomberg' },
  { url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', source: 'marketwatch' },
  { url: 'https://www.ft.com/rss/home', source: 'ft' },
  // 中央銀行・政府機関
  { url: 'https://www.federalreserve.gov/feeds/press_all.xml', source: 'fed' },
  { url: 'https://www.ecb.europa.eu/rss/press.html', source: 'ecb' },
  // 金融特化メディア
  { url: 'https://feeds.feedburner.com/zerohedge/feed', source: 'zerohedge' },
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
    const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd,jpy`, { headers: { 'User-Agent': 'Econoguard/1.0' }, signal: AbortSignal.timeout(10000) });
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

// --- LLM Provider ---
// Supports any OpenAI-compatible API (Groq, OpenAI, Together, OpenRouter, etc.) + Gemini
//
// Config via env vars:
//   LLM_PROVIDER=groq|gemini|openai (auto-detect if not set)
//   LLM_BASE_URL=https://api.groq.com/openai/v1 (override API endpoint)
//   LLM_MODEL=llama-3.3-70b-versatile (override model)
//   LLM_API_KEY=... (override API key)
//
// Provider-specific keys (auto-detect):
//   GROQ_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY

interface LLMConfig {
  provider: string;
  baseUrl: string;
  model: string;
  key: string;
}

const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; model: string }> = {
  groq:     { baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  openai:   { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  together: { baseUrl: 'https://api.together.xyz/v1', model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-3.3-70b-instruct' },
};

function detectProvider(): LLMConfig | null {
  // Explicit full config
  if (process.env.LLM_API_KEY && process.env.LLM_BASE_URL) {
    return {
      provider: process.env.LLM_PROVIDER || 'custom',
      baseUrl: process.env.LLM_BASE_URL,
      model: process.env.LLM_MODEL || 'default',
      key: process.env.LLM_API_KEY,
    };
  }

  // Auto-detect from provider-specific keys
  const explicit = process.env.LLM_PROVIDER;
  const pairs: Array<[string, string | undefined]> = [
    ['groq', process.env.GROQ_API_KEY],
    ['gemini', process.env.GEMINI_API_KEY],
    ['openai', process.env.OPENAI_API_KEY],
  ];

  // Prioritize explicit provider
  if (explicit) {
    const match = pairs.find(([p]) => p === explicit);
    if (match?.[1]) {
      const defaults = PROVIDER_DEFAULTS[explicit] || { baseUrl: '', model: '' };
      return {
        provider: explicit,
        baseUrl: process.env.LLM_BASE_URL || defaults.baseUrl,
        model: process.env.LLM_MODEL || defaults.model,
        key: match[1],
      };
    }
  }

  // Auto-detect: first available key wins
  for (const [provider, key] of pairs) {
    if (key) {
      const defaults = PROVIDER_DEFAULTS[provider] || { baseUrl: '', model: '' };
      return { provider, baseUrl: defaults.baseUrl, model: defaults.model, key };
    }
  }

  return null;
}

async function callLLM(system: string, user: string): Promise<string> {
  const config = detectProvider();
  if (!config) throw new Error('No LLM configured. Set GROQ_API_KEY, GEMINI_API_KEY, or LLM_API_KEY+LLM_BASE_URL.');

  if (config.provider === 'gemini') {
    return callGemini(system, user, config.key);
  }
  return callOpenAICompatible(system, user, config);
}

async function callOpenAICompatible(system: string, user: string, config: LLMConfig): Promise<string> {
  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    signal: AbortSignal.timeout(30000),
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.key}` },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      temperature: 0.3,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`${config.provider} ${res.status}: ${await res.text()}`);
  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0].message.content;
}

async function callGemini(system: string, user: string, key: string): Promise<string> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: process.env.LLM_MODEL || 'gemini-2.0-flash',
    systemInstruction: system,
  });
  const r = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: user }] }] });
  return r.response.text();
}

function parseJson(text: string): unknown {
  try {
    let s = text.trim();
    if (s.startsWith('```')) s = s.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    return JSON.parse(s);
  } catch (e) {
    console.error('JSON parse failed:', e instanceof Error ? e.message : e);
    console.error('Raw text (first 200 chars):', text.slice(0, 200));
    throw new Error('LLM returned invalid JSON');
  }
}

async function summarize(articles: NewsArticle[]) {
  const todo = articles.filter(a => !a.summaryJa);
  if (!todo.length) return;

  const SYS = `あなたは経済ニュースアナリストです。与えられたニュース記事を分析し、JSON形式で応答してください。

各記事について:
- summaryJa: 日本語で2-3文の簡潔な要約（経済的インパクトを中心に）
- relevanceScore: 世界経済リスクとの関連度（0.0-1.0）
- riskCategories: 関連するカテゴリの配列。選択肢: "currency_finance", "geopolitics_supply_chain", "technology", "social_policy"

応答は必ず以下のJSON形式: {"results":[{"index":0,"summaryJa":"...","relevanceScore":0.8,"riskCategories":["currency_finance"]}]}`;

  for (let i = 0; i < Math.min(todo.length, 50); i += 10) {
    const batch = todo.slice(i, i + 10);
    const msg = batch.map((a, j) => `[${j}] ${a.source}: ${a.originalTitle}`).join('\n');
    try {
      const raw = await callLLM(SYS, msg);
      const parsed = parseJson(raw) as { results: Array<{ index: number; summaryJa: string; relevanceScore: number; riskCategories: string[] }> };
      const results = parsed.results || [];
      for (const r of results) {
        if (batch[r.index]) {
          batch[r.index].summaryJa = r.summaryJa;
          batch[r.index].relevanceScore = r.relevanceScore;
          batch[r.index].riskCategories = r.riskCategories;
        }
      }
      console.log(`  Batch ${Math.floor(i / 10) + 1} done (${results.length} summarized)`);
    } catch (e) { console.error('  Summarize failed:', e instanceof Error ? e.message : e); }
    if (i + 10 < todo.length) await new Promise(r => setTimeout(r, 500));
  }
}

async function assess(news: NewsArticle[], indicators: EconomicIndicator[], prev: RiskAssessment[]): Promise<RiskAssessment[]> {
  const SYS = `あなたはグローバル経済リスクアナリストです。提供データに基づき、4カテゴリのリスクを0-100で評価してください。

カテゴリ: currency_finance(通貨・金融), geopolitics_supply_chain(地政学・供給網), technology(テクノロジー), social_policy(社会・政策)

スコア基準: 0-20:低, 21-40:中程度, 41-60:やや高い, 61-80:高い, 81-100:危機的

応答は必ず以下のJSON形式:
{"assessments":[{"category":"currency_finance","score":65,"summary":"日本語2-3文の概要","factors":["寄与因子1","寄与因子2","寄与因子3"]}]}

4カテゴリ全て含めてください。`;

  let ctx = '## 最新ニュース\n';
  for (const a of news.filter(a => a.summaryJa).slice(0, 20)) ctx += `- [${a.source}] ${a.summaryJa}\n`;
  ctx += '\n## 経済指標\n';
  for (const i of indicators) ctx += `- ${i.name}: ${i.value}${i.unit}${i.previousValue ? ` (前回:${i.previousValue})` : ''}\n`;
  if (prev.length) { ctx += '\n## 前回スコア\n'; for (const r of prev) ctx += `- ${r.category}: ${r.score}\n`; }

  const raw = await callLLM(SYS, ctx);
  const res = parseJson(raw) as { assessments: Array<{ category: string; score: number; summary: string; factors: string[] }> };
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

  console.log('\n=== Saved to frontend/public/data/ ===');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
