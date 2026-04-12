import prisma from '../lib/prisma.js';
import { config } from '../lib/config.js';

interface IndicatorDefinition {
  code: string;
  name: string;
  unit: string;
  source: string;
  fetch: () => Promise<number | null>;
}

async function fetchFRED(seriesId: string): Promise<number | null> {
  if (!config.fredApiKey) {
    console.log(`FRED API key not configured, skipping ${seriesId}`);
    return null;
  }

  try {
    const url = new URL('https://api.stlouisfed.org/fred/series/observations');
    url.searchParams.set('series_id', seriesId);
    url.searchParams.set('api_key', config.fredApiKey);
    url.searchParams.set('file_type', 'json');
    url.searchParams.set('sort_order', 'desc');
    url.searchParams.set('limit', '1');

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`FRED responded with ${response.status}`);

    const data = await response.json() as {
      observations?: Array<{ value?: string }>;
    };

    const value = data.observations?.[0]?.value;
    if (!value || value === '.') return null;
    return parseFloat(value);
  } catch (error) {
    console.error(`Failed to fetch FRED ${seriesId}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

async function fetchCoinGecko(coinId: string): Promise<number | null> {
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Econoguard/1.0' },
    });
    if (!response.ok) throw new Error(`CoinGecko responded with ${response.status}`);

    const data = await response.json() as Record<string, { usd?: number }>;
    return data[coinId]?.usd ?? null;
  } catch (error) {
    console.error(`Failed to fetch CoinGecko ${coinId}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

async function fetchExchangeRate(currency: string): Promise<number | null> {
  if (!config.openExchangeRatesAppId) {
    console.log('Open Exchange Rates key not configured, skipping');
    return null;
  }

  try {
    const url = `https://openexchangerates.org/api/latest.json?app_id=${config.openExchangeRatesAppId}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`OpenExchangeRates responded with ${response.status}`);

    const data = await response.json() as { rates?: Record<string, number> };
    return data.rates?.[currency] ?? null;
  } catch (error) {
    console.error(`Failed to fetch exchange rate for ${currency}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

const indicators: IndicatorDefinition[] = [
  {
    code: 'VIX',
    name: 'VIX恐怖指数',
    unit: '',
    source: 'fred',
    fetch: () => fetchFRED('VIXCLS'),
  },
  {
    code: 'US_CPI',
    name: '米国CPI（前年比）',
    unit: '%',
    source: 'fred',
    fetch: () => fetchFRED('CPIAUCSL'),
  },
  {
    code: 'US_FFR',
    name: '米国政策金利',
    unit: '%',
    source: 'fred',
    fetch: () => fetchFRED('FEDFUNDS'),
  },
  {
    code: 'US10Y',
    name: '米10年国債利回り',
    unit: '%',
    source: 'fred',
    fetch: () => fetchFRED('DGS10'),
  },
  {
    code: 'GOLD',
    name: '金価格',
    unit: 'USD/oz',
    source: 'fred',
    fetch: () => fetchFRED('GOLDAMGBD228NLBM'),
  },
  {
    code: 'USDJPY',
    name: 'ドル円',
    unit: '円',
    source: 'openexchangerates',
    fetch: () => fetchExchangeRate('JPY'),
  },
  {
    code: 'BTC',
    name: 'ビットコイン',
    unit: 'USD',
    source: 'coingecko',
    fetch: () => fetchCoinGecko('bitcoin'),
  },
  {
    code: 'ETH',
    name: 'イーサリアム',
    unit: 'USD',
    source: 'coingecko',
    fetch: () => fetchCoinGecko('ethereum'),
  },
];

async function getPreviousValue(code: string): Promise<number | null> {
  const prev = await prisma.economicIndicator.findFirst({
    where: { code },
    orderBy: { recordedAt: 'desc' },
  });
  return prev?.value ?? null;
}

export async function collectIndicators(): Promise<{ collected: number; failed: number }> {
  const now = new Date();
  // Truncate to the hour for recordedAt to avoid unique constraint issues on rapid re-runs
  now.setMinutes(0, 0, 0);

  let collected = 0;
  let failed = 0;

  for (const indicator of indicators) {
    try {
      console.log(`Fetching indicator: ${indicator.code}...`);
      const value = await indicator.fetch();

      if (value === null) {
        console.log(`  -> ${indicator.code}: no data`);
        failed++;
        continue;
      }

      const previousValue = await getPreviousValue(indicator.code);

      await prisma.economicIndicator.upsert({
        where: {
          code_recordedAt: {
            code: indicator.code,
            recordedAt: now,
          },
        },
        update: { value, previousValue },
        create: {
          code: indicator.code,
          name: indicator.name,
          value,
          previousValue,
          unit: indicator.unit,
          source: indicator.source,
          recordedAt: now,
        },
      });

      console.log(`  -> ${indicator.code}: ${value} ${indicator.unit}`);
      collected++;
    } catch (error) {
      console.error(`Failed to collect ${indicator.code}:`, error instanceof Error ? error.message : error);
      failed++;
    }
  }

  console.log(`Indicator collection complete: ${collected} collected, ${failed} failed`);
  return { collected, failed };
}
