import { useQuery } from '@tanstack/react-query';
import { fetchIndicators } from '../../services/api';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { formatNumber, formatChange } from '../../lib/formatters';

export function IndicatorPanel() {
  const { data: indicators, isLoading } = useQuery({
    queryKey: ['indicators'],
    queryFn: fetchIndicators,
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-200 mb-3">経済指標</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {indicators?.map((ind) => {
          const change = formatChange(ind.value, ind.previousValue);
          return (
            <div key={ind.code} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
              <div className="text-xs text-gray-500 mb-1">{ind.name}</div>
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
