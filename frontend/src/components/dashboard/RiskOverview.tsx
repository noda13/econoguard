import { useQuery } from '@tanstack/react-query';
import { fetchRisks } from '../../services/api';
import { RiskGauge } from './RiskGauge';
import { LoadingSpinner } from '../common/LoadingSpinner';

export function RiskOverview() {
  const { data: risks, isLoading } = useQuery({
    queryKey: ['risks'],
    queryFn: fetchRisks,
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-200 mb-3">リスク評価</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {risks?.map((risk) => (
          <RiskGauge key={risk.category} risk={risk} />
        ))}
      </div>
    </div>
  );
}
