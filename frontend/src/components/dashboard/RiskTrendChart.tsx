import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { fetchRiskHistory } from '../../services/api';
import { categoryLabels } from '../../lib/riskColors';
import { LoadingSpinner } from '../common/LoadingSpinner';

const CATEGORY_COLORS: Record<string, string> = {
  currency_finance: '#f87171',
  geopolitics_supply_chain: '#fb923c',
  technology: '#60a5fa',
  social_policy: '#a78bfa',
};

const CATEGORIES = ['currency_finance', 'geopolitics_supply_chain', 'technology', 'social_policy'] as const;

interface ChartDataPoint {
  date: string;
  [key: string]: string | number | undefined;
}

export function RiskTrendChart() {
  const q1 = useQuery({ queryKey: ['riskHistory', 'currency_finance'], queryFn: () => fetchRiskHistory('currency_finance', 30) });
  const q2 = useQuery({ queryKey: ['riskHistory', 'geopolitics_supply_chain'], queryFn: () => fetchRiskHistory('geopolitics_supply_chain', 30) });
  const q3 = useQuery({ queryKey: ['riskHistory', 'technology'], queryFn: () => fetchRiskHistory('technology', 30) });
  const q4 = useQuery({ queryKey: ['riskHistory', 'social_policy'], queryFn: () => fetchRiskHistory('social_policy', 30) });

  const results = [q1, q2, q3, q4];
  const isLoading = results.some((r) => r.isLoading);

  if (isLoading) return <LoadingSpinner />;

  const dataMap = new Map<string, ChartDataPoint>();
  for (let i = 0; i < CATEGORIES.length; i++) {
    const cat = CATEGORIES[i];
    const data = results[i].data || [];
    for (const item of data) {
      const dateStr = new Date(item.assessedAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
      const point = dataMap.get(dateStr) || { date: dateStr };
      point[cat] = item.score;
      dataMap.set(dateStr, point);
    }
  }

  const chartData = Array.from(dataMap.values());

  if (chartData.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 text-center text-gray-500 text-sm">
        リスク推移データがまだありません
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-200 mb-3">リスク推移（30日間）</h2>
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 100]} stroke="#6b7280" tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#d1d5db' }}
            />
            <Legend
              formatter={(value: string) => categoryLabels[value] || value}
              wrapperStyle={{ fontSize: '12px' }}
            />
            <ReferenceLine y={60} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
            <ReferenceLine y={40} stroke="#eab308" strokeDasharray="3 3" strokeOpacity={0.3} />
            {CATEGORIES.map((cat) => (
              <Line
                key={cat}
                type="monotone"
                dataKey={cat}
                stroke={CATEGORY_COLORS[cat]}
                strokeWidth={2}
                dot={{ r: 3 }}
                name={cat}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
