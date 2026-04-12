import { z } from 'zod';

export const riskCategorySchema = z.enum([
  'currency_finance',
  'geopolitics_supply_chain',
  'technology',
  'social_policy',
]);

export type RiskCategory = z.infer<typeof riskCategorySchema>;

export const riskLevelSchema = z.enum(['low', 'moderate', 'elevated', 'high', 'critical']);
export type RiskLevel = z.infer<typeof riskLevelSchema>;

export function scoreToLevel(score: number): RiskLevel {
  if (score <= 20) return 'low';
  if (score <= 40) return 'moderate';
  if (score <= 60) return 'elevated';
  if (score <= 80) return 'high';
  return 'critical';
}

export const categoryLabels: Record<RiskCategory, string> = {
  currency_finance: '通貨・金融リスク',
  geopolitics_supply_chain: '地政学・サプライチェーン',
  technology: 'テクノロジーリスク',
  social_policy: '社会・政策リスク',
};
