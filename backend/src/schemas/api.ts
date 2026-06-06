import { z } from 'zod';
import { scoreToLevel, RISK_WEIGHTS } from './riskConstants.js';
import type { RiskLevel, RiskCategory } from './riskConstants.js';

export const riskCategorySchema = z.enum([
  'currency_finance',
  'geopolitics_supply_chain',
  'technology',
  'social_policy',
]);

// Re-export the canonical types so consumers can import from a single place.
export type { RiskCategory, RiskLevel };

export const riskLevelSchema = z.enum(['low', 'moderate', 'elevated', 'high', 'critical']);

// scoreToLevel already returns RiskLevel — no cast needed.
export { scoreToLevel, RISK_WEIGHTS };

export const categoryLabels: Record<RiskCategory, string> = {
  currency_finance: '通貨・金融リスク',
  geopolitics_supply_chain: '地政学・サプライチェーン',
  technology: 'テクノロジーリスク',
  social_policy: '社会・政策リスク',
};
