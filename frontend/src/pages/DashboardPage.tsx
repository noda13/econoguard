import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { CompositeRiskBanner } from '../components/dashboard/CompositeRiskBanner';
import { RiskOverview } from '../components/dashboard/RiskOverview';
import { RiskTrendChart } from '../components/dashboard/RiskTrendChart';
import { IndicatorPanel } from '../components/dashboard/IndicatorPanel';
import { NewsFeed } from '../components/dashboard/NewsFeed';
import { PortfolioImpactPanel } from '../components/dashboard/PortfolioImpactPanel';
import { fetchRisks } from '../services/api';

export function DashboardPage() {
  const { data: risks } = useQuery({ queryKey: ['risks'], queryFn: fetchRisks });

  const lastUpdated = useMemo(() => {
    if (!risks?.length) return undefined;
    return risks.reduce((a, b) =>
      new Date(a.assessedAt) > new Date(b.assessedAt) ? a : b
    ).assessedAt;
  }, [risks]);

  return (
    <DashboardLayout lastUpdated={lastUpdated}>
      <CompositeRiskBanner />
      <RiskOverview />
      <PortfolioImpactPanel />
      <RiskTrendChart />
      <IndicatorPanel />
      <NewsFeed />
    </DashboardLayout>
  );
}
