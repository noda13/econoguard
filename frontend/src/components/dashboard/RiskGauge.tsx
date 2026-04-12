import { riskLevelConfig, categoryLabels } from '../../lib/riskColors';
import type { RiskAssessment } from '../../services/api';

interface Props {
  risk: RiskAssessment;
}

export function RiskGauge({ risk }: Props) {
  const config = riskLevelConfig[risk.level] || riskLevelConfig.moderate;
  const label = categoryLabels[risk.category] || risk.category;
  const factors: string[] = typeof risk.factorsJa === 'string' ? JSON.parse(risk.factorsJa || '[]') : risk.factorsJa || [];

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
    </div>
  );
}
