import { useQuery } from '@tanstack/react-query';
import { fetchNews } from '../../services/api';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { formatDate } from '../../lib/formatters';
import { categoryLabels } from '../../lib/riskColors';

export function NewsFeed() {
  const { data: articles, isLoading } = useQuery({
    queryKey: ['news'],
    queryFn: () => fetchNews(20),
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-200 mb-3">最新ニュース</h2>
      <div className="space-y-3">
        {articles?.map((article) => {
          const categories: string[] = typeof article.riskCategories === 'string' ? JSON.parse(article.riskCategories || '[]') : article.riskCategories || [];
          return (
            <div key={article.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-gray-500 uppercase font-mono">{article.source}</span>
                <span className="text-xs text-gray-600">|</span>
                <span className="text-xs text-gray-500">{formatDate(article.publishedAt)}</span>
              </div>
              <h3 className="text-sm font-medium text-gray-200 mb-1">{article.originalTitle}</h3>
              {article.summaryJa ? (
                <p className="text-sm text-gray-400 mb-2">{article.summaryJa}</p>
              ) : (
                <p className="text-sm text-gray-600 italic mb-2">要約待ち...</p>
              )}
              <div className="flex gap-1 flex-wrap">
                {categories.map((cat) => (
                  <span key={cat} className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded">
                    {categoryLabels[cat] || cat}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
