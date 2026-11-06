import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { summarize } from './summarize.js';
import { callLLM } from './llm.js';
import type { NewsArticle } from './types.js';

vi.mock('./llm.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./llm.js')>()),
  callLLM: vi.fn(),
}));

const callLLMMock = vi.mocked(callLLM);

function article(id: number, over: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id: `id${id}`, source: 'test', originalTitle: `title ${id}`, originalUrl: `https://e.com/${id}`,
    publishedAt: '2026-10-01T00:00:00.000Z', summaryJa: '', relevanceScore: 0, riskCategories: [], ...over,
  };
}

function result(index: number, over: Record<string, unknown> = {}) {
  return { index, summaryJa: `summary ${index}`, relevanceScore: 70, riskCategories: ['technology'], ...over };
}

describe('summarize', () => {
  beforeEach(() => {
    callLLMMock.mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not call the LLM when every article already has a summary', async () => {
    await summarize([article(0, { summaryJa: 'done' })]);
    expect(callLLMMock).not.toHaveBeenCalled();
  });

  it('writes summary, score and categories back onto the articles by batch index', async () => {
    callLLMMock.mockResolvedValue(JSON.stringify({ results: [result(0), result(1, { relevanceScore: 10, riskCategories: [] })] }));
    const news = [article(0), article(1)];
    await summarize(news);
    expect(news[0]).toMatchObject({ summaryJa: 'summary 0', relevanceScore: 70, riskCategories: ['technology'] });
    expect(news[1]).toMatchObject({ summaryJa: 'summary 1', relevanceScore: 10, riskCategories: [] });
  });

  it('sends only unsummarized articles to the LLM', async () => {
    callLLMMock.mockResolvedValue(JSON.stringify({ results: [result(0)] }));
    await summarize([article(0, { summaryJa: 'done' }), article(1)]);
    expect(callLLMMock.mock.calls[0][1]).toBe('[0] test: title 1');
  });

  it('drops invalid entries and out-of-range indexes but keeps the valid ones', async () => {
    callLLMMock.mockResolvedValue(JSON.stringify({
      results: [result(0), result(1, { relevanceScore: 150 }), result(5), result(0, { riskCategories: ['mystery'] })],
    }));
    const news = [article(0), article(1)];
    await summarize(news);
    expect(news[0].summaryJa).toBe('summary 0');
    expect(news[1].summaryJa).toBe('');
  });

  it('continues with the next batch when one batch fails', async () => {
    vi.useFakeTimers();
    callLLMMock
      .mockRejectedValueOnce(new Error('rate limited'))
      .mockResolvedValueOnce(JSON.stringify({ results: [result(0)] }));
    const news = Array.from({ length: 11 }, (_, i) => article(i));
    const done = summarize(news);
    await vi.runAllTimersAsync();
    await done;
    expect(callLLMMock).toHaveBeenCalledTimes(2);
    expect(news[0].summaryJa).toBe('');
    expect(news[10].summaryJa).toBe('summary 0');
  });

  it('processes at most 50 articles per run', async () => {
    vi.useFakeTimers();
    callLLMMock.mockResolvedValue(JSON.stringify({ results: [] }));
    const done = summarize(Array.from({ length: 80 }, (_, i) => article(i)));
    await vi.runAllTimersAsync();
    await done;
    expect(callLLMMock).toHaveBeenCalledTimes(5);
  });
});
