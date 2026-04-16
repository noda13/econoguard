import { riskLevelConfig, categoryLabels } from '../../lib/riskColors';
import type { RiskAssessment } from '../../services/api';
import { useUserProfile } from '../../contexts/UserProfileContext';
import { calculateCategoryImpact } from '../../lib/personalizedRisk';

interface Props {
  risk: RiskAssessment;
}

export function RiskGauge({ risk }: Props) {
  const config = riskLevelConfig[risk.level] || riskLevelConfig.moderate;
  const label = categoryLabels[risk.category] || risk.category;
  const factors: string[] = (() => {
    if (Array.isArray(risk.factorsJa)) return risk.factorsJa;
    try {
      const parsed = JSON.parse(risk.factorsJa || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();
  const { profile, isConfigured } = useUserProfile();
  const impact = isConfigured && profile
    ? calculateCategoryImpact(risk.category, risk.score, profile.allocation)
    : null;

  return (
    <div className={`rounded-lg border ${config.borderColor} ${config.bgColor} p-4`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-300">{label}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${config.bgColor} ${config.color} font-bold`}>
          {config.label}
        </span>
      </div>
      <div className={`text-3xl font-bold ${config.color} mb-2`}>
        {risk.score}
        <span className="text-sm text-gray-500 ml-1">/100</span>
      </div>
      <p className="text-sm text-gray-400 mb-3 line-clamp-2">{risk.summaryJa}</p>
      <div className="space-y-1">
        {factors.slice(0, 3).map((factor, i) => (
          <div key={i} className="text-xs text-gray-500 flex items-start gap-1">
            <span className="mt-0.5">•</span>
            <span>{factor}</span>
          </div>
        ))}
      </div>
      {impact && (
        <div className="mt-3 pt-2 border-t border-gray-700/50">
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            impact.impactLevel === 'high' ? 'bg-red-900/30 text-red-400' :
            impact.impactLevel === 'medium' ? 'bg-yellow-900/30 text-yellow-400' :
            'bg-green-900/30 text-green-400'
          }`}>
            あなたへの影響: {impact.impactLevel === 'high' ? '高' : impact.impactLevel === 'medium' ? '中' : '低'}
          </span>
        </div>
      )}
    </div>
  );
}
