import type {
  AssetAllocation,
  MonitoringSensitivity,
  UserProfile,
  ActionSignal,
  CategoryImpact,
  PersonalizedResult,
} from './types/profile';
import { getSignalFromScore } from './actionSignals';
import type { RiskAssessment, CompositeRisk } from '../services/api';

// ---------------------------------------------------------------------------
// 1. Utility
// ---------------------------------------------------------------------------

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ---------------------------------------------------------------------------
// 2. Individual sensitivity calculators
// ---------------------------------------------------------------------------

/**
 * Age-based sensitivity multiplier.
 * Older investors carry more sensitivity to drawdowns.
 * 48 years old → 1.195
 */
export function calculateAgeSensitivity(age: number): number {
  return clamp(1 + (age - 35) * 0.015, 0.85, 1.35);
}

/**
 * Equity-weight sensitivity multiplier.
 * Higher equity exposure amplifies risk scores.
 * 90% equity → 1.06
 */
export function calculateEquitySensitivity(allocation: AssetAllocation): number {
  const totalEquity =
    allocation.domestic_equity +
    allocation.developed_equity +
    allocation.emerging_equity;
  return clamp(0.7 + totalEquity * 0.004, 0.7, 1.3);
}

/**
 * Total foreign / overseas exposure (%).
 * Includes all non-domestic equity, bonds, and REITs.
 */
export function calculateForeignExposure(allocation: AssetAllocation): number {
  return (
    allocation.developed_equity +
    allocation.emerging_equity +
    allocation.developed_bond +
    allocation.emerging_bond +
    allocation.developed_reit
  );
}

/**
 * Monitoring-sensitivity preference multiplier.
 */
export function getSensitivityMultiplier(sensitivity: MonitoringSensitivity): number {
  const map: Record<MonitoringSensitivity, number> = {
    sensitive: 1.15,
    standard: 1.0,
    relaxed: 0.85,
  };
  return map[sensitivity];
}

// ---------------------------------------------------------------------------
// 3. Composite personalized score
// ---------------------------------------------------------------------------

/**
 * Personalize a generic risk score with the user's age, equity weight, and
 * monitoring-sensitivity preference. Returns a clamped integer 0–100.
 */
export function calculatePersonalizedScore(
  genericScore: number,
  profile: UserProfile,
): number {
  const ageSensitivity = calculateAgeSensitivity(profile.age);
  const equitySensitivity = calculateEquitySensitivity(profile.allocation);
  const sensitivityMultiplier = getSensitivityMultiplier(profile.sensitivity);

  const raw = genericScore * ageSensitivity * equitySensitivity * sensitivityMultiplier;
  return Math.round(clamp(raw, 0, 100));
}

// ---------------------------------------------------------------------------
// 4. Category → asset-class impact mapping
// ---------------------------------------------------------------------------

const CATEGORY_IMPACT_MAP: Record<
  string,
  { high: (keyof AssetAllocation)[]; medium: (keyof AssetAllocation)[]; low: (keyof AssetAllocation)[] }
> = {
  currency_finance: {
    high: ['developed_equity', 'developed_bond', 'developed_reit', 'emerging_equity', 'emerging_bond'],
    medium: ['domestic_equity', 'domestic_reit'],
    low: ['domestic_bond', 'cash'],
  },
  geopolitics_supply_chain: {
    high: ['emerging_equity', 'emerging_bond'],
    medium: ['developed_equity', 'developed_bond', 'domestic_equity'],
    low: ['domestic_bond', 'cash', 'domestic_reit'],
  },
  technology: {
    high: ['developed_equity'],
    medium: ['emerging_equity', 'domestic_equity'],
    low: ['domestic_bond', 'developed_bond', 'cash'],
  },
  social_policy: {
    high: ['domestic_bond', 'domestic_equity', 'domestic_reit'],
    medium: ['developed_bond'],
    low: ['developed_equity', 'cash'],
  },
};

// ---------------------------------------------------------------------------
// 5. Per-category impact calculation
// ---------------------------------------------------------------------------

/**
 * Given a risk category and the user's allocation, returns how strongly that
 * category affects the portfolio.
 */
export function calculateCategoryImpact(
  category: string,
  _score: number,
  allocation: AssetAllocation,
): CategoryImpact {
  const mapping = CATEGORY_IMPACT_MAP[category];

  // If the category is unknown, return a neutral low-impact result
  if (!mapping) {
    return {
      category,
      impactLevel: 'low',
      affectedPct: 0,
      description: '該当カテゴリの影響は限定的です。現在のポートフォリオへの影響は限定的',
    };
  }

  // Sum the allocation percentages for "high" impact asset classes
  const affectedPct = Math.round(
    mapping.high.reduce((sum, key) => sum + allocation[key], 0),
  );

  // Determine overall impact level from the affected percentage
  const impactLevel: 'high' | 'medium' | 'low' =
    affectedPct >= 40 ? 'high' : affectedPct >= 15 ? 'medium' : 'low';

  // Build the Japanese description
  const lowSuffix = impactLevel === 'low' ? '。現在のポートフォリオへの影響は限定的' : '';

  const descriptionMap: Record<string, string> = {
    currency_finance: `ドル建て資産(${affectedPct}%)に直接影響。円高進行時の為替差損リスク${lowSuffix}`,
    geopolitics_supply_chain: `新興国資産(${affectedPct}%)への地政学リスク。供給網の混乱が懸念${lowSuffix}`,
    technology: `先進国株式(${affectedPct}%)のテック比率に注意。規制・半導体リスク${lowSuffix}`,
    social_policy: `国内資産(${affectedPct}%)に政策変更の影響。金利動向に注意${lowSuffix}`,
  };

  const description = descriptionMap[category] ?? `リスクカテゴリ(${affectedPct}%)への影響${lowSuffix}`;

  return { category, impactLevel, affectedPct, description };
}

// ---------------------------------------------------------------------------
// 6. Main entry point
// ---------------------------------------------------------------------------

/**
 * Personalize composite + category risk data with the user's profile.
 */
export function personalizeRisk(
  compositeRisk: CompositeRisk,
  risks: RiskAssessment[],
  profile: UserProfile,
): PersonalizedResult {
  const personalizedScore = calculatePersonalizedScore(
    compositeRisk.compositeScore,
    profile,
  );

  const signal: ActionSignal = getSignalFromScore(personalizedScore);

  const categoryImpacts: CategoryImpact[] = risks.map((risk) =>
    calculateCategoryImpact(risk.category, risk.score, profile.allocation),
  );

  const totalEquity =
    profile.allocation.domestic_equity +
    profile.allocation.developed_equity +
    profile.allocation.emerging_equity;
  const equityPct = Math.round(totalEquity);

  const signalDescriptionMap: Record<ActionSignal, string> = {
    hold: '現状維持で問題ない水準です',
    watch: '市場動向を注視すべき水準です',
    prepare: 'リバランスの準備を検討すべき水準です',
    hedge: 'ヘッジを検討すべき水準です',
    act: '即座にリスク対応を検討すべき水準です',
  };

  const interpretation = `${profile.age}歳・株式${equityPct}%のポートフォリオでは、${signalDescriptionMap[signal]}`;

  return { personalizedScore, signal, categoryImpacts, interpretation };
}

// ---------------------------------------------------------------------------
// 7. Threshold helpers for chart reference lines
// ---------------------------------------------------------------------------

/**
 * Returns warning / alert thresholds in the *generic* score scale so that
 * reference lines on the trend chart align correctly with the raw API values.
 *
 * Divide the desired personalized thresholds (40 / 60) by the combined
 * personalization multiplier to map them back to generic score space.
 */
export function getPersonalizedThresholds(
  profile: UserProfile,
): { warning: number; alert: number } {
  const ageSensitivity = calculateAgeSensitivity(profile.age);
  const equitySensitivity = calculateEquitySensitivity(profile.allocation);
  const sensitivityMultiplier = getSensitivityMultiplier(profile.sensitivity);

  const combinedMultiplier = ageSensitivity * equitySensitivity * sensitivityMultiplier;

  return {
    warning: clamp(Math.round(40 / combinedMultiplier), 10, 90),
    alert: clamp(Math.round(60 / combinedMultiplier), 10, 90),
  };
}

// ---------------------------------------------------------------------------
// 8. Indicator relevance
// ---------------------------------------------------------------------------

/**
 * Returns how relevant a market indicator is for a given portfolio allocation.
 */
export function getIndicatorRelevance(
  indicatorCode: string,
  allocation: AssetAllocation,
): 'high' | 'medium' | 'low' {
  const foreignExposure = calculateForeignExposure(allocation);
  const totalEquity =
    allocation.domestic_equity +
    allocation.developed_equity +
    allocation.emerging_equity;

  switch (indicatorCode) {
    case 'USDJPY':
      if (foreignExposure > 50) return 'high';
      if (foreignExposure > 20) return 'medium';
      return 'low';

    case 'VIX':
      if (totalEquity > 60) return 'high';
      if (totalEquity > 30) return 'medium';
      return 'low';

    case 'GOLD':
      return 'medium';

    case 'US10Y':
      if (allocation.developed_bond > 20) return 'high';
      if (totalEquity > 50) return 'medium';
      return 'low';

    case 'US_CPI':
    case 'US_FFR':
      if (foreignExposure > 50) return 'high';
      if (foreignExposure > 20) return 'medium';
      return 'low';

    case 'BTC':
    case 'ETH':
      return 'low';

    default:
      return 'low';
  }
}
