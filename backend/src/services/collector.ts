import prisma from '../lib/prisma.js';
import { collectNews } from './newsCollector.js';
import { collectIndicators } from './indicatorCollector.js';
import { summarizeUnsummarized } from './summarizer.js';
import { assessRisks } from './riskAssessor.js';
import { getSessionTokenUsage, resetSessionTokenUsage, ensureProviderReady } from './llm.js';

export class CollectionInProgressError extends Error {
  constructor() {
    super('Collection already in progress');
    this.name = 'CollectionInProgressError';
  }
}

interface CollectionResult {
  news: { collected: number; skipped: number };
  indicators: { collected: number; failed: number };
  summarization: { summarized: number };
  riskAssessment: { assessed: boolean };
}

// [Fix #6] KNOWN LIMITATION: _isRunning is an in-process boolean lock.
// It prevents concurrent collections within a single Node.js process but does NOT protect
// against multiple instances running simultaneously (e.g. horizontally-scaled deployments,
// process restarts mid-run, or serverless re-invocations).
// If multi-instance deployments are needed in future, replace this with a distributed lock
// (e.g. a DB-backed advisory lock or a Redis SETNX lock).
let _isRunning = false;

export async function runCollection(): Promise<CollectionResult> {
  if (_isRunning) {
    throw new CollectionInProgressError();
  }
  _isRunning = true;
  try {
    resetSessionTokenUsage();
    await ensureProviderReady();

    const log = await prisma.collectionLog.create({
      data: {
        jobType: 'full_collection',
        status: 'running',
      },
    });

    try {
      console.log('=== Starting data collection ===');
      const startTime = Date.now();

      // Step 1: Collect news
      console.log('\n--- Collecting news ---');
      const newsResult = await collectNews();

      // Step 2: Collect indicators
      console.log('\n--- Collecting indicators ---');
      const indicatorResult = await collectIndicators();

      // Step 3: Summarize new articles
      let summaryResult = { summarized: 0 };
      try {
        console.log('\n--- Summarizing news ---');
        summaryResult = await summarizeUnsummarized();
      } catch (error) {
        console.error('Summarization failed (non-fatal):', error instanceof Error ? error.message : error);
      }

      // Step 4: Assess risks
      let riskResult = { assessed: false };
      try {
        console.log('\n--- Assessing risks ---');
        riskResult = await assessRisks();
      } catch (error) {
        console.error('Risk assessment failed (non-fatal):', error instanceof Error ? error.message : error);
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const tokenUsage = getSessionTokenUsage();
      console.log(`\n=== Collection complete in ${duration}s ===`);
      console.log(`News: ${newsResult.collected} new, ${newsResult.skipped} skipped`);
      console.log(`Indicators: ${indicatorResult.collected} collected, ${indicatorResult.failed} failed`);
      console.log(`Summarized: ${summaryResult.summarized} articles`);
      console.log(`Risk assessed: ${riskResult.assessed}`);
      console.log(`Tokens used: ${tokenUsage.inputTokens} in, ${tokenUsage.outputTokens} out`);

      await prisma.collectionLog.update({
        where: { id: log.id },
        data: {
          status: 'success',
          completedAt: new Date(),
          articlesCollected: newsResult.collected,
          tokensUsed: tokenUsage.inputTokens + tokenUsage.outputTokens,
          message: `News: ${newsResult.collected}. Summarized: ${summaryResult.summarized}. Risk: ${riskResult.assessed}.`,
        },
      });

      return {
        news: newsResult,
        indicators: indicatorResult,
        summarization: { summarized: summaryResult.summarized },
        riskAssessment: riskResult,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Collection failed:', message);

      await prisma.collectionLog.update({
        where: { id: log.id },
        data: {
          status: 'error',
          completedAt: new Date(),
          message,
        },
      });

      throw error;
    }
  } finally {
    _isRunning = false;
  }
}
