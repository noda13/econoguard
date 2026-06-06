import axios from 'axios';

// Detect if running in static mode (GitHub Pages)
const isStatic = import.meta.env.VITE_STATIC_DATA === 'true';

const api = axios.create({
  baseURL: '/api',
  // Prevent requests from hanging indefinitely on a stalled backend
  timeout: 10000,
});

// Normalize axios errors into a consistent shape so callers get a
// meaningful message without needing to inspect AxiosError internals.
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const status: number | undefined =
      axios.isAxiosError(error) ? error.response?.status : undefined;
    const message: string =
      axios.isAxiosError(error)
        ? (error.response?.data as { message?: string })?.message ?? error.message
        : String(error);
    return Promise.reject(Object.assign(new Error(message), { status }));
  },
);

export interface NewsArticle {
  id: number | string;
  sourceId?: string;
  source: string;
  originalTitle: string;
  originalUrl: string;
  publishedAt: string;
  summaryJa: string;
  relevanceScore: number;
  // Always string[] after fetch boundary normalization (was string | string[])
  riskCategories: string[];
  createdAt?: string;
}

export interface RiskAssessment {
  id?: number;
  category: string;
  score: number;
  level: string;
  summaryJa: string;
  // Always string[] after fetch boundary normalization (was string | string[])
  factorsJa: string[];
  assessedAt: string;
  createdAt?: string;
}

// ---------------------------------------------------------------------------
// Normalization helpers — parse backend values that may arrive as either a
// JSON-encoded string or an already-decoded array into a plain string[].
// ---------------------------------------------------------------------------

function toStringArray(value: string | string[] | undefined | null): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as string[]) : [value];
  } catch {
    return [value];
  }
}

function normalizeNewsArticle(raw: NewsArticle & { riskCategories: string | string[] }): NewsArticle {
  return { ...raw, riskCategories: toStringArray(raw.riskCategories) };
}

function normalizeRiskAssessment(raw: RiskAssessment & { factorsJa: string | string[] }): RiskAssessment {
  return { ...raw, factorsJa: toStringArray(raw.factorsJa) };
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
    return all.slice(0, limit).map(normalizeNewsArticle);
  }
  const params: Record<string, string> = { limit: String(limit) };
  if (_category) params.category = _category;
  const { data } = await api.get<NewsArticle[]>('/news', { params });
  return data.map(normalizeNewsArticle);
};

export const fetchRisks = async (): Promise<RiskAssessment[]> => {
  if (isStatic) {
    const all = await fetchStaticJson<RiskAssessment[]>('risks.json', []);
    return all.map(normalizeRiskAssessment);
  }
  const { data } = await api.get<RiskAssessment[]>('/risks');
  return data.map(normalizeRiskAssessment);
};

export const fetchRiskHistory = async (category: string, _days = 30): Promise<RiskAssessment[]> => {
  if (isStatic) {
    const history = await fetchStaticJson<Record<string, RiskAssessment[]>>('risk-history.json', {});
    return (history[category] || []).map(normalizeRiskAssessment);
  }
  const { data } = await api.get<RiskAssessment[]>(`/risks/${category}`, { params: { days: _days } });
  return data.map(normalizeRiskAssessment);
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
