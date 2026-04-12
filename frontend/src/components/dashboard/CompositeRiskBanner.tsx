import { useQuery } from '@tanstack/react-query';
import { fetchCompositeRisk } from '../../services/api';
import { riskLevelConfig } from '../../lib/riskColors';

export function CompositeRiskBanner() {
  const { data } = useQuery({
    queryKey: ['compositeRisk'],
    queryFn: fetchCompositeRisk,
  });

  if (!data) return null;

  const config = riskLevelConfig[data.level] || riskLevelConfig.moderate;

  return (
    <div className={`rounded-lg border-2 ${config.borderColor} ${config.bgColor} p-5`}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-gray-400 mb-1">総合リスク指数</h2>
          <div className="flex items-baseline gap-2">
            <span className={`text-5xl font-bold ${config.color}`}>{data.compositeScore}</span>
            <span className="text-lg text-gray-500">/100</span>
            <span className={`text-sm px-3 py-1 rounded-full ${config.bgColor} ${config.color} font-bold border ${config.borderColor}`}>
              {config.label}
            </span>
          </div>
        </div>
        <div className="hidden md:flex gap-4">
          {data.breakdown.map((item) => (
            <div key={item.category} className="text-center">
              <div className="text-xs text-gray-500 mb-1">
                {item.category === 'currency_finance' ? '通貨・金融'
                  : item.category === 'geopolitics_supply_chain' ? '地政学'
                  : item.category === 'technology' ? 'テクノロジー'
                  : '社会・政策'}
              </div>
              <div className="text-sm font-mono text-gray-300">{item.score}</div>
              <div className="text-xs text-gray-600">x{item.weight}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
