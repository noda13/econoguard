import { useQuery } from '@tanstack/react-query';
import { fetchCompositeRisk, fetchRisks } from '../../services/api';
import { riskLevelConfig } from '../../lib/riskColors';
import { useUserProfile } from '../../contexts/UserProfileContext';
import { usePersonalizedRisk } from '../../hooks/usePersonalizedRisk';
import { ACTION_SIGNAL_CONFIG } from '../../lib/actionSignals';

export function CompositeRiskBanner() {
  const { data } = useQuery({
    queryKey: ['compositeRisk'],
    queryFn: fetchCompositeRisk,
  });

  const { data: risks } = useQuery({
    queryKey: ['risks'],
    queryFn: fetchRisks,
  });

  const { result: personalized, isConfigured } = usePersonalizedRisk(data, risks);

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
      {personalized && (() => {
        const signalConfig = ACTION_SIGNAL_CONFIG[personalized.signal];
        return (
          <div className="mt-4 pt-4 border-t border-gray-700/50">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-baseline gap-2">
                <span className="text-sm text-gray-400">あなたのリスク:</span>
                <span className={`text-2xl font-bold ${signalConfig.color}`}>
                  {personalized.personalizedScore}
                </span>
                <span className="text-sm text-gray-500">/100</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${signalConfig.bgColor} ${signalConfig.color} font-bold border ${signalConfig.borderColor}`}>
                  {signalConfig.label}
                </span>
              </div>
              <p className="text-sm text-gray-400">{personalized.interpretation}</p>
            </div>
          </div>
        );
      })()}
      {!isConfigured && (
        <div className="mt-3 text-xs text-gray-500">
          歯車アイコンからプロフィールを設定すると、パーソナライズされたリスク評価が表示されます
        </div>
      )}
    </div>
  );
}
