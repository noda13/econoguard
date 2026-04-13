import axios from 'axios';

// Detect if running in static mode (GitHub Pages)
const isStatic = import.meta.env.VITE_STATIC_DATA === 'true' || !import.meta.env.DEV;

const api = axios.create({
  baseURL: '/api',
});

export interface NewsArticle {
  id: number | string;
  sourceId?: string;
  source: string;
  originalTitle: string;
  originalUrl: string;
  publishedAt: string;
  summaryJa: string;
  relevanceScore: number;
  riskCategories: string | string[];
  createdAt?: string;
}

export interface RiskAssessment {
  id?: number;
  category: string;
  score: number;
  level: string;
  summaryJa: string;
  factorsJa: string | string[];
  assessedAt: string;
  createdAt?: string;
}

export interface EconomicIndicator {
  id?: number;
  code: string;
  name: string;
  value: number;
  previousValue: number | null;
  unit: string;
  source: string;
  recordedAt: string;
}

export interface CompositeRisk {
  compositeScore: number;
  level: string;
  breakdown: Array<{
    category: string;
    score: number;
    weight: number;
  }>;
}

// --- Static JSON fetchers ---

async function fetchStaticJson<T>(filename: string, fallback: T): Promise<T> {
  try {
    const base = import.meta.env.BASE_URL || '/';
    const res = await fetch(`${base}data/${filename}`);
    if (!res.ok) return fallback;
    return await res.json();
  } catch {
    return fallback;
  }
}

// --- API functions ---

export const fetchNews = async (limit = 20, _category?: string): Promise<NewsArticle[]> => {
  if (isStatic) {
    const all = await fetchStaticJson<NewsArticle[]>('news.json', []);
    return all.slice(0, limit);
  }
  const params: Record<string, string> = { limit: String(limit) };
  if (_category) params.category = _category;
  const { data } = await api.get('/news', { params });
  return data;
};

export const fetchRisks = async (): Promise<RiskAssessment[]> => {
  if (isStatic) {
    return fetchStaticJson<RiskAssessment[]>('risks.json', []);
  }
  const { data } = await api.get('/risks');
  return data;
};

export const fetchRiskHistory = async (category: string, _days = 30): Promise<RiskAssessment[]> => {
  if (isStatic) {
    const history = await fetchStaticJson<Record<string, RiskAssessment[]>>('risk-history.json', {});
    return history[category] || [];
  }
  const { data } = await api.get(`/risks/${category}`, { params: { days: _days } });
  return data;
};

export const fetchIndicators = async (): Promise<EconomicIndicator[]> => {
  if (isStatic) {
    return fetchStaticJson<EconomicIndicator[]>('indicators.json', []);
  }
  const { data } = await api.get('/indicators');
  return data;
};

export const fetchCompositeRisk = async (): Promise<CompositeRisk> => {
  if (isStatic) {
    return fetchStaticJson<CompositeRisk>('composite-risk.json', { compositeScore: 0, level: 'low', breakdown: [] });
  }
  const { data } = await api.get('/risks/composite');
  return data;
};
