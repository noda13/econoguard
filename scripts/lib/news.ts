import Parser from 'rss-parser';
import crypto from 'crypto';
import type { NewsArticle } from './types.js';

export const RSS_SOURCES = [
  { url: 'https://feeds.bloomberg.com/markets/news.rss', source: 'bloomberg' },
  { url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114', source: 'cnbc' },
  { url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', source: 'marketwatch' },
  { url: 'https://feeds.content.dowjones.io/public/rss/RSSMarketsMain', source: 'wsj' },
  { url: 'https://www.ft.com/rss/home', source: 'ft' },
  { url: 'https://www.economist.com/finance-and-economics/rss.xml', source: 'economist' },
  { url: 'https://www.federalreserve.gov/feeds/press_all.xml', source: 'fed' },
  { url: 'https://www.ecb.europa.eu/rss/press.html', source: 'ecb' },
  { url: 'https://www.boj.or.jp/rss/whatsnew.xml', source: 'boj' },
  { url: 'https://assets.wor.jp/rss/rdf/nikkei/news.rdf', source: 'nikkei' },
];

function genId(url: string, title: string): string {
  return crypto.createHash('sha256').update(`${url}:${title}`).digest('hex').slice(0, 16);
}

const MIN_RELEVANCE = 30;
const MAX_NEWS = 200;
const MAX_SEEN_IDS = 2000;

// Unsummarized articles are kept so they are not dropped before the next LLM run can score them.
export function selectPublishedNews(news: NewsArticle[]): NewsArticle[] {
  return news.filter(a => !a.summaryJa || a.relevanceScore >= MIN_RELEVANCE).slice(0, MAX_NEWS);
}

// Low-relevance articles leave news.json but still reappear in the RSS feeds; remembering their ids
// keeps them from consuming the per-run summarize budget again.
export function nextSeenIds(prevSeen: string[], news: NewsArticle[]): string[] {
  const dropped = news.filter(a => a.summaryJa && a.relevanceScore < MIN_RELEVANCE).map(a => a.id);
  return [...new Set([...prevSeen, ...dropped])].slice(-MAX_SEEN_IDS);
}

function toIsoOrNow(pubDate: string | undefined): string {
  const d = pubDate ? new Date(pubDate) : new Date();
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export async function collectNews(existing: NewsArticle[], seenIds: string[] = []): Promise<NewsArticle[]> {
  const parser = new Parser({ timeout: 10000, headers: { 'User-Agent': 'Econoguard/1.0' } });
  const ids = new Set([...existing.map(a => a.id), ...seenIds]);
  const fresh: NewsArticle[] = [];

  const results = await Promise.allSettled(
    RSS_SOURCES.map(async (src) => {
      const feed = await parser.parseURL(src.url);
      const items: NewsArticle[] = [];
      for (const item of feed.items || []) {
        if (!item.title || !item.link) continue;
        const id = genId(item.link, item.title);
        if (ids.has(id)) continue;
        ids.add(id);
        items.push({
          id, source: src.source, originalTitle: item.title, originalUrl: item.link,
          publishedAt: toIsoOrNow(item.pubDate),
          summaryJa: '', relevanceScore: 0, riskCategories: [],
        });
      }
      console.log(`  ${src.source}: ${feed.items?.length || 0} items`);
      return items;
    }),
  );

  for (const r of results) {
    if (r.status === 'fulfilled') fresh.push(...r.value);
    else console.error(`  RSS failed:`, r.reason instanceof Error ? r.reason.message : r.reason);
  }

  const all = [...fresh, ...existing];
  all.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  return all.slice(0, 200);
}
