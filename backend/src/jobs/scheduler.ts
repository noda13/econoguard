import cron from 'node-cron';
import { runCollection, CollectionInProgressError } from '../services/collector.js';

// Module-level guard: a secondary safety net in case runCollection's internal lock
// ever fails to clear (e.g. unhandled rejection before unlock).  The primary
// overlap protection is delegated to runCollection via CollectionInProgressError.
let isRunning = false;

async function scheduledCollection() {
  if (isRunning) {
    console.log('[Scheduler] Collection already running (module guard), skipping');
    return;
  }
  isRunning = true;
  try {
    console.log(`[Scheduler] Starting scheduled collection at ${new Date().toISOString()}`);
    await runCollection();
    console.log('[Scheduler] Scheduled collection completed');
  } catch (error) {
    if (error instanceof CollectionInProgressError) {
      console.log('[Scheduler] Collection already running (runCollection lock), skipping');
      return;
    }
    console.error('[Scheduler] Collection failed:', error instanceof Error ? error.message : error);
  } finally {
    isRunning = false;
  }
}

export function startScheduler() {
  // Collect news + assess risks at 7:00 and 19:00 JST
  cron.schedule('0 7,19 * * *', scheduledCollection, {
    timezone: 'Asia/Tokyo',
  });

  console.log('[Scheduler] Cron jobs scheduled:');
  console.log('  - Data collection: 7:00, 19:00 JST');
}
