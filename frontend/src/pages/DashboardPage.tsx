import { DashboardLayout } from '../components/layout/DashboardLayout';
import { CompositeRiskBanner } from '../components/dashboard/CompositeRiskBanner';
import { RiskOverview } from '../components/dashboard/RiskOverview';
import { RiskTrendChart } from '../components/dashboard/RiskTrendChart';
import { IndicatorPanel } from '../components/dashboard/IndicatorPanel';
import { NewsFeed } from '../components/dashboard/NewsFeed';

export function DashboardPage() {
  return (
    <DashboardLayout>
      <CompositeRiskBanner />
      <RiskOverview />
      <RiskTrendChart />
      <IndicatorPanel />
      <NewsFeed />
    </DashboardLayout>
  );
}
