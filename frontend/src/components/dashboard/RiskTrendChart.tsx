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

const CATEGORIES = ['currency_finance', 'geopolitics_supply_chain', 'technology', 'social_policy'];

interface ChartDataPoint {
  date: string;
  currency_finance?: number;
  geopolitics_supply_chain?: number;
  technology?: number;
  social_policy?: number;
}

export function RiskTrendChart() {
  const queries = CATEGORIES.map((cat) => ({
    queryKey: ['riskHistory', cat],
    queryFn: () => fetchRiskHistory(cat, 30),
  }));

  const results = queries.map((q) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useQuery(q)
  );

  const isLoading = results.some((r) => r.isLoading);

  if (isLoading) return <LoadingSpinner />;

  // Merge all category data into a single timeline
  const dataMap = new Map<string, ChartDataPoint>();

  for (let i = 0; i < CATEGORIES.length; i++) {
    const cat = CATEGORIES[i];
    const data = results[i].data || [];
    for (const item of data) {
      const dateStr = new Date(item.assessedAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
      const point = dataMap.get(dateStr) || { date: dateStr };
      (point as Record<string, unknown>)[cat] = item.score;
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
