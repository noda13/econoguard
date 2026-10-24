import { describe, expect, it } from 'vitest';
import { computeComposite } from './composite.js';
import type { RiskAssessment } from './types.js';

function risk(category: string, score: number): RiskAssessment {
  return { category, score, level: 'low', summaryJa: '', factorsJa: [], assessedAt: '2026-10-24T00:00:00.000Z' };
}

describe('computeComposite', () => {
  it('weights currency_finance and geopolitics_supply_chain at 0.3 and technology and social_policy at 0.2', () => {
    const result = computeComposite(
      [risk('currency_finance', 10), risk('geopolitics_supply_chain', 20), risk('technology', 30), risk('social_policy', 40)],
      0,
    );
    expect(result.compositeScore).toBe(23);
    expect(result.breakdown).toEqual([
      { category: 'currency_finance', score: 10, weight: 0.3 },
      { category: 'geopolitics_supply_chain', score: 20, weight: 0.3 },
      { category: 'technology', score: 30, weight: 0.2 },
      { category: 'social_policy', score: 40, weight: 0.2 },
    ]);
  });

  it('puts the whole weight of one category into the score when the others are zero', () => {
    const only = (category: string) =>
      computeComposite(
        ['currency_finance', 'geopolitics_supply_chain', 'technology', 'social_policy'].map(c => risk(c, c === category ? 100 : 0)),
        0,
      ).compositeScore;
    expect(only('currency_finance')).toBe(30);
    expect(only('geopolitics_supply_chain')).toBe(30);
    expect(only('technology')).toBe(20);
    expect(only('social_policy')).toBe(20);
  });

  it('renormalises the weights over the categories that are present', () => {
    const result = computeComposite([risk('currency_finance', 80), risk('technology', 20)], 0);
    expect(result.compositeScore).toBe(56);
  });

  it('returns the score itself for a single category', () => {
    expect(computeComposite([risk('social_policy', 73)], 0).compositeScore).toBe(73);
  });

  it('ignores unknown categories in both the score and the breakdown', () => {
    const result = computeComposite([risk('currency_finance', 40), risk('mystery', 100)], 0);
    expect(result.compositeScore).toBe(40);
    expect(result.breakdown.map(b => b.category)).toEqual(['currency_finance']);
  });

  it.each(['toString', 'constructor', 'hasOwnProperty', '__proto__', 'valueOf'])(
    'treats the inherited property name %s as an unknown category',
    (name) => {
      const result = computeComposite([risk('currency_finance', 40), risk(name, 100)], 0);
      expect(result.compositeScore).toBe(40);
      expect(result.breakdown.map(b => b.category)).toEqual(['currency_finance']);
    },
  );

  it('returns score 0 and an empty breakdown when every category is an inherited property name', () => {
    const result = computeComposite([risk('toString', 100), risk('constructor', 100)], 0);
    expect(result.compositeScore).toBe(0);
    expect(result.breakdown).toEqual([]);
  });

  it('returns score 0, level low and an empty breakdown for no risks', () => {
    const result = computeComposite([], 0);
    expect(result.compositeScore).toBe(0);
    expect(result.level).toBe('low');
    expect(result.breakdown).toEqual([]);
  });

  it('returns score 0 when every category is unknown', () => {
    const result = computeComposite([risk('mystery', 100)], 0);
    expect(result.compositeScore).toBe(0);
    expect(result.level).toBe('low');
  });

  it('rounds half up and otherwise to the nearest integer', () => {
    expect(computeComposite([risk('currency_finance', 1), risk('geopolitics_supply_chain', 0)], 0).compositeScore).toBe(1);
    expect(computeComposite([risk('currency_finance', 1), risk('technology', 0)], 0).compositeScore).toBe(1);
    expect(computeComposite([risk('currency_finance', 0), risk('technology', 1)], 0).compositeScore).toBe(0);
  });

  it('derives the level from the rounded score at the 20/21 boundary', () => {
    const all = (score: number) =>
      ['currency_finance', 'geopolitics_supply_chain', 'technology', 'social_policy'].map(c => risk(c, score));
    expect(computeComposite(all(20), 0).level).toBe('low');
    expect(computeComposite(all(21), 0).level).toBe('moderate');
    expect(computeComposite(all(81), 0).level).toBe('critical');
  });

  describe('delta', () => {
    it('is undefined when the previous score is 0', () => {
      expect(computeComposite([risk('technology', 50)], 0).delta).toBeUndefined();
    });

    it('is the score difference when the previous score is positive', () => {
      expect(computeComposite([risk('technology', 50)], 40).delta).toBe(10);
      expect(computeComposite([risk('technology', 30)], 40).delta).toBe(-10);
    });

    it('is 0 rather than undefined when the score is unchanged', () => {
      expect(computeComposite([risk('technology', 40)], 40).delta).toBe(0);
    });

    it('is computed from the rounded score', () => {
      const result = computeComposite([risk('currency_finance', 1), risk('geopolitics_supply_chain', 0)], 5);
      expect(result.compositeScore).toBe(1);
      expect(result.delta).toBe(-4);
    });

    it('is undefined when there are no risks, even with a positive previous score', () => {
      expect(computeComposite([], 40).delta).toBeUndefined();
    });

    it('is undefined when every category is unknown, even with a positive previous score', () => {
      expect(computeComposite([risk('mystery', 100)], 40).delta).toBeUndefined();
      expect(computeComposite([risk('toString', 100)], 40).delta).toBeUndefined();
    });

    it('treats a previous score of 1 as a valid baseline', () => {
      expect(computeComposite([risk('technology', 50)], 1).delta).toBe(49);
    });
  });
});
