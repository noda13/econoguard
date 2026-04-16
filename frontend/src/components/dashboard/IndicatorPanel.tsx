import { useQuery } from '@tanstack/react-query';
import { fetchIndicators } from '../../services/api';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { formatNumber, formatChange } from '../../lib/formatters';
import { useUserProfile } from '../../contexts/UserProfileContext';
import { getIndicatorRelevance } from '../../lib/personalizedRisk';

export function IndicatorPanel() {
  const { data: indicators, isLoading } = useQuery({
    queryKey: ['indicators'],
    queryFn: fetchIndicators,
  });
  const { profile, isConfigured } = useUserProfile();

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-200 mb-3">経済指標</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {indicators?.map((ind) => {
          const change = formatChange(ind.value, ind.previousValue);
          const relevance = isConfigured && profile
            ? getIndicatorRelevance(ind.code, profile.allocation)
            : null;
          return (
            <div key={ind.code} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-xs text-gray-500">{ind.name}</span>
                {relevance === 'high' && (
                  <span className="text-[10px] px-1.5 py-0 rounded bg-blue-900/40 text-blue-400 font-medium">
                    注目
                  </span>
                )}
              </div>
              <div className="text-lg font-bold text-gray-100">
                {formatNumber(ind.value)}
                {ind.unit && <span className="text-xs text-gray-500 ml-1">{ind.unit}</span>}
              </div>
              {change && (
                <div className={`text-xs ${change.isPositive ? 'text-red-400' : 'text-green-400'}`}>
                  {change.text}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
