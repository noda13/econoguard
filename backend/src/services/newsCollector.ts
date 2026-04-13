import Parser from 'rss-parser';
import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import { config } from '../lib/config.js';

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Econoguard/1.0',
  },
});

const RSSHUB = process.env.RSSHUB_URL || 'https://rsshub.app';

const RSS_SOURCES = [
  // === 日本語ソース ===
  { name: 'nhk', url: 'https://www.nhk.or.jp/rss/news/cat5.xml', source: 'nhk' },
  { name: 'boj', url: 'https://www.boj.or.jp/rss/whatsnew.xml', source: 'boj' },
  { name: 'nikkei', url: 'https://assets.wor.jp/rss/rdf/nikkei/news.rdf', source: 'nikkei' },
  { name: 'mof_jp', url: 'https://www.mof.go.jp/rss/whatsnew.xml', source: 'mof_jp' },
  // === 海外メディア ===
  { name: 'google_biz', url: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtcGhHZ0pLVUNnQVAB', source: 'google_biz' },
  { name: 'google_world', url: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNREpmTjNRU0FtcGhHZ0pLVUNnQVAB', source: 'google_world' },
  { name: 'cnbc', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114', source: 'cnbc' },
  { name: 'bloomberg', url: 'https://feeds.bloomberg.com/markets/news.rss', source: 'bloomberg' },
  { name: 'marketwatch', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', source: 'marketwatch' },
  { name: 'ft', url: 'https://www.ft.com/rss/home', source: 'ft' },
  // === 中央銀行・政府機関 ===
  { name: 'fed', url: 'https://www.federalreserve.gov/feeds/press_all.xml', source: 'fed' },
  { name: 'ecb', url: 'https://www.ecb.europa.eu/rss/press.html', source: 'ecb' },
  // === 金融特化メディア ===
  { name: 'zerohedge', url: 'https://feeds.feedburner.com/zerohedge/feed', source: 'zerohedge' },
  // === X/Twitter via RSSHub ===
  { name: 'x_dalio', url: `${RSSHUB}/twitter/user/RayDalio`, source: 'x_dalio' },
  { name: 'x_elikan', url: `${RSSHUB}/twitter/user/elikinosian`, source: 'x_elikan' },
  { name: 'x_rickards', url: `${RSSHUB}/twitter/user/jimrickards`, source: 'x_rickards' },
  { name: 'x_goldtelegraph', url: `${RSSHUB}/twitter/user/GoldTelegraph_`, source: 'x_goldtelegraph' },
  { name: 'x_wss', url: `${RSSHUB}/twitter/user/WallStreetSilv`, source: 'x_wss' },
  { name: 'x_elerian', url: `${RSSHUB}/twitter/user/elerianm`, source: 'x_elerian' },
  { name: 'x_roubini', url: `${RSSHUB}/twitter/user/NourielRoubini`, source: 'x_roubini' },
  { name: 'x_schiff', url: `${RSSHUB}/twitter/user/PeterSchiff`, source: 'x_schiff' },
];

interface RawArticle {
  sourceId: string;
  source: string;
  originalTitle: string;
  originalUrl: string;
  publishedAt: Date;
  rawContent?: string;
}

function generateSourceId(url: string, title: string): string {
  return crypto.createHash('sha256').update(`${url}:${title}`).digest('hex').slice(0, 32);
}

async function fetchRSS(): Promise<RawArticle[]> {
  const articles: RawArticle[] = [];

  for (const rssSource of RSS_SOURCES) {
    try {
      console.log(`Fetching RSS: ${rssSource.name}...`);
      const feed = await parser.parseURL(rssSource.url);

      for (const item of feed.items || []) {
        if (!item.title || !item.link) continue;

        articles.push({
          sourceId: generateSourceId(item.link, item.title),
          source: rssSource.source,
          originalTitle: item.title,
          originalUrl: item.link,
          publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
          rawContent: item.contentSnippet || item.content || undefined,
        });
      }

      console.log(`  -> ${feed.items?.length || 0} articles from ${rssSource.name}`);
    } catch (error) {
      console.error(`Failed to fetch RSS from ${rssSource.name}:`, error instanceof Error ? error.message : error);
    }
  }

  return articles;
}

async function fetchNewsAPI(): Promise<RawArticle[]> {
  if (!config.newsApiKey) {
    console.log('NewsAPI key not configured, skipping');
    return [];
  }

  const articles: RawArticle[] = [];
  const keywords = ['economy crisis', 'trade war', 'inflation', 'central bank', 'financial risk', 'CBDC', 'tariff'];
  const query = keywords.join(' OR ');

  try {
    console.log('Fetching NewsAPI...');
    const url = new URL('https://newsapi.org/v2/everything');
    url.searchParams.set('q', query);
    url.searchParams.set('language', 'en');
    url.searchParams.set('sortBy', 'publishedAt');
    url.searchParams.set('pageSize', '20');
    url.searchParams.set('apiKey', config.newsApiKey);

    const response = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      throw new Error(`NewsAPI responded with ${response.status}`);
    }

    const data = await response.json() as {
      articles?: Array<{
        title?: string;
        url?: string;
        publishedAt?: string;
        description?: string;
        source?: { name?: string };
      }>;
    };

    for (const item of data.articles || []) {
      if (!item.title || !item.url) continue;

      articles.push({
        sourceId: generateSourceId(item.url, item.title),
        source: `newsapi_${(item.source?.name || 'unknown').toLowerCase().replace(/\s+/g, '_')}`,
        originalTitle: item.title,
        originalUrl: item.url,
        publishedAt: item.publishedAt ? new Date(item.publishedAt) : new Date(),
        rawContent: item.description || undefined,
      });
    }

    console.log(`  -> ${articles.length} articles from NewsAPI`);
  } catch (error) {
    console.error('Failed to fetch NewsAPI:', error instanceof Error ? error.message : error);
  }

  return articles;
}

export async function collectNews(): Promise<{ collected: number; skipped: number }> {
  const [rssArticles, newsApiArticles] = await Promise.all([
    fetchRSS(),
    fetchNewsAPI(),
  ]);

  const allArticles = [...rssArticles, ...newsApiArticles];
  let collected = 0;
  let skipped = 0;

  for (const article of allArticles) {
    try {
      await prisma.newsArticle.upsert({
        where: { sourceId: article.sourceId },
        update: {},  // Don't update existing articles
        create: {
          sourceId: article.sourceId,
          source: article.source,
          originalTitle: article.originalTitle,
          originalUrl: article.originalUrl,
          publishedAt: article.publishedAt,
          summaryJa: '',  // Will be filled by summarizer in Phase 3
          relevanceScore: 0,
          riskCategories: '[]',
        },
      });
      collected++;
    } catch (error) {
      // Unique constraint violation = already exists, that's fine
      skipped++;
    }
  }

  console.log(`News collection complete: ${collected} new, ${skipped} skipped`);
  return { collected, skipped };
}

export type { RawArticle };
