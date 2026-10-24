import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { CompositeRiskBanner } from '../components/dashboard/CompositeRiskBanner';
import { RiskOverview } from '../components/dashboard/RiskOverview';
import { RiskTrendChart } from '../components/dashboard/RiskTrendChart';
import { IndicatorPanel } from '../components/dashboard/IndicatorPanel';
import { NewsFeed } from '../components/dashboard/NewsFeed';
import { PortfolioImpactPanel } from '../components/dashboard/PortfolioImpactPanel';
import { EventCalendar } from '../components/dashboard/EventCalendar';
import { fetchRisks, fetchCompositeRisk, fetchLastUpdated } from '../services/api';

const STALE_THRESHOLD_DAYS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function DashboardPage() {
  const { data: risks, isError: isRisksError } = useQuery({ queryKey: ['risks'], queryFn: fetchRisks });
  const { isError: isCompositeError } = useQuery({ queryKey: ['compositeRisk'], queryFn: fetchCompositeRisk });
  const { data: collectedAt } = useQuery({ queryKey: ['lastUpdated'], queryFn: fetchLastUpdated });

  const lastUpdated = useMemo(() => {
    if (!risks?.length) return undefined;
    return risks.reduce((a, b) =>
      new Date(a.assessedAt) > new Date(b.assessedAt) ? a : b
    ).assessedAt;
  }, [risks]);

  const ageMs = collectedAt ? Date.now() - new Date(collectedAt).getTime() : 0;
  const staleDays = ageMs > STALE_THRESHOLD_DAYS * MS_PER_DAY ? Math.floor(ageMs / MS_PER_DAY) : 0;

  return (
    <DashboardLayout lastUpdated={lastUpdated}>
      {staleDays > 0 && (
        <div className="rounded-lg border border-amber-700 bg-amber-900/30 px-4 py-3 text-sm text-amber-300">
          データが {staleDays} 日間更新されていません。表示内容は古い可能性があります。
        </div>
      )}
      {(isRisksError || isCompositeError) && (
        <div className="rounded-lg border border-red-700 bg-red-900/30 px-4 py-3 text-sm text-red-300">
          リスクデータの取得に失敗しました。しばらくしてからページを再読み込みしてください。
        </div>
      )}
      <CompositeRiskBanner />
      <RiskOverview />
      <PortfolioImpactPanel />
      <RiskTrendChart />
      <IndicatorPanel />
      <EventCalendar />
      <NewsFeed />
    </DashboardLayout>
  );
}
