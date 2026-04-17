import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchNews } from '../../services/api';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { formatDate } from '../../lib/formatters';
import { categoryLabels } from '../../lib/riskColors';

export function NewsFeed() {
  const { data: articles, isLoading } = useQuery({
    queryKey: ['news'],
    queryFn: () => fetchNews(50),
  });

  const filtered = useMemo(() => {
    if (!articles) return [];
    return articles
      .filter(a => a.relevanceScore >= 30)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 20);
  }, [articles]);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-200 mb-3">最新ニュース</h2>
      <div className="space-y-3">
        {filtered.length === 0 && articles && articles.length > 0 ? (
          <p className="text-sm text-gray-500">関連度の高いニュースはありません</p>
        ) : (
          filtered.map((article) => {
            const categories: string[] = (() => {
              if (Array.isArray(article.riskCategories)) return article.riskCategories;
              try {
                const parsed = JSON.parse(article.riskCategories || '[]');
                return Array.isArray(parsed) ? parsed : [];
              } catch {
                return [];
              }
            })();
            return (
              <div key={article.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-500 uppercase font-mono">{article.source}</span>
                  <span className="text-xs text-gray-600">|</span>
                  <span className="text-xs text-gray-500">{formatDate(article.publishedAt)}</span>
                  {article.relevanceScore >= 70 && (
                    <span className="text-xs bg-red-900/30 text-red-400 px-1.5 py-0.5 rounded">重要</span>
                  )}
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
          })
        )}
      </div>
    </div>
  );
}
