import { describe, expect, it } from 'vitest';
import { ACTION_SIGNAL_CONFIG, getSignalFromScore } from './actionSignals';

describe('getSignalFromScore', () => {
  it.each([
    [0, 'hold'],
    [30, 'hold'],
    [31, 'watch'],
    [50, 'watch'],
    [51, 'prepare'],
    [70, 'prepare'],
    [71, 'hedge'],
    [85, 'hedge'],
    [86, 'act'],
    [100, 'act'],
  ])('maps score %i to %s', (score, signal) => {
    expect(getSignalFromScore(score)).toBe(signal);
  });

  it('returns a signal that has a display configuration for every score', () => {
    for (let score = 0; score <= 100; score++) {
      expect(ACTION_SIGNAL_CONFIG[getSignalFromScore(score)]).toBeDefined();
    }
  });
});
