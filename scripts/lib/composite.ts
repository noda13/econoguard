import { RISK_WEIGHTS, scoreToLevel, type RiskCategory } from '../../backend/src/schemas/riskConstants.js';
import type { CompositeRisk, RiskAssessment } from './types.js';

export function computeComposite(risks: RiskAssessment[], prevCompositeScore: number): CompositeRisk {
  const knownRisks = risks.filter(r => Object.hasOwn(RISK_WEIGHTS, r.category));
  const totalWeight = knownRisks.reduce((s, r) => s + RISK_WEIGHTS[r.category as RiskCategory], 0);
  const compositeScore = totalWeight > 0
    ? Math.round(knownRisks.reduce((s, r) => s + r.score * (RISK_WEIGHTS[r.category as RiskCategory] / totalWeight), 0))
    : 0;
  return {
    compositeScore,
    level: scoreToLevel(compositeScore),
    breakdown: knownRisks.map(r => ({ category: r.category, score: r.score, weight: RISK_WEIGHTS[r.category as RiskCategory] })),
    delta: knownRisks.length > 0 && prevCompositeScore > 0 ? compositeScore - prevCompositeScore : undefined,
  };
}
