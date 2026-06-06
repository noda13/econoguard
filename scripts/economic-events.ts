// NOTE: This file must be updated annually. Events listed for 2026.

export interface EconomicEvent {
  date: string;        // ISO date string (YYYY-MM-DD)
  titleJa: string;     // Japanese event title
  region: 'US' | 'JP' | 'EU' | 'GLOBAL';
  importance: 'high' | 'medium';
}

export const ECONOMIC_EVENTS: EconomicEvent[] = [
  // January 2026
  { date: '2026-01-09', titleJa: '米雇用統計(非農業部門雇用者数)発表', region: 'US', importance: 'high' },
  { date: '2026-01-13', titleJa: '米CPI(消費者物価指数)発表', region: 'US', importance: 'high' },
  { date: '2026-01-23', titleJa: '日銀金融政策決定会合', region: 'JP', importance: 'high' },
  { date: '2026-01-28', titleJa: 'FOMC政策金利発表', region: 'US', importance: 'high' },
  { date: '2026-01-29', titleJa: 'ECB理事会(政策金利決定)', region: 'EU', importance: 'high' },
  { date: '2026-01-29', titleJa: '米GDP速報値発表', region: 'US', importance: 'medium' },

  // February 2026
  { date: '2026-02-06', titleJa: '米雇用統計(非農業部門雇用者数)発表', region: 'US', importance: 'high' },
  { date: '2026-02-11', titleJa: '米CPI(消費者物価指数)発表', region: 'US', importance: 'high' },
  { date: '2026-02-16', titleJa: '日本GDP速報値発表', region: 'JP', importance: 'medium' },

  // March 2026
  { date: '2026-03-05', titleJa: 'ECB理事会(政策金利決定)', region: 'EU', importance: 'high' },
  { date: '2026-03-06', titleJa: '米雇用統計(非農業部門雇用者数)発表', region: 'US', importance: 'high' },
  { date: '2026-03-11', titleJa: '米CPI(消費者物価指数)発表', region: 'US', importance: 'high' },
  { date: '2026-03-18', titleJa: 'FOMC政策金利発表', region: 'US', importance: 'high' },
  { date: '2026-03-19', titleJa: '日銀金融政策決定会合', region: 'JP', importance: 'high' },

  // April 2026
  { date: '2026-04-03', titleJa: '米雇用統計(非農業部門雇用者数)発表', region: 'US', importance: 'high' },
  { date: '2026-04-14', titleJa: '米CPI(消費者物価指数)発表', region: 'US', importance: 'high' },
  { date: '2026-04-16', titleJa: 'ECB理事会(政策金利決定)', region: 'EU', importance: 'high' },
  { date: '2026-04-29', titleJa: '米GDP速報値発表', region: 'US', importance: 'medium' },
  { date: '2026-04-30', titleJa: '日銀金融政策決定会合', region: 'JP', importance: 'high' },

  // May 2026
  { date: '2026-05-06', titleJa: 'FOMC政策金利発表', region: 'US', importance: 'high' },
  { date: '2026-05-08', titleJa: '米雇用統計(非農業部門雇用者数)発表', region: 'US', importance: 'high' },
  { date: '2026-05-13', titleJa: '米CPI(消費者物価指数)発表', region: 'US', importance: 'high' },
  { date: '2026-05-18', titleJa: '日本GDP速報値発表', region: 'JP', importance: 'medium' },

  // June 2026
  { date: '2026-06-04', titleJa: 'ECB理事会(政策金利決定)', region: 'EU', importance: 'high' },
  { date: '2026-06-05', titleJa: '米雇用統計(非農業部門雇用者数)発表', region: 'US', importance: 'high' },
  { date: '2026-06-10', titleJa: '米CPI(消費者物価指数)発表', region: 'US', importance: 'high' },
  { date: '2026-06-16', titleJa: '日銀金融政策決定会合', region: 'JP', importance: 'high' },
  { date: '2026-06-17', titleJa: 'FOMC政策金利発表', region: 'US', importance: 'high' },

  // July 2026
  { date: '2026-07-10', titleJa: '米雇用統計(非農業部門雇用者数)発表', region: 'US', importance: 'high' },
  { date: '2026-07-14', titleJa: '米CPI(消費者物価指数)発表', region: 'US', importance: 'high' },
  { date: '2026-07-23', titleJa: 'ECB理事会(政策金利決定)', region: 'EU', importance: 'high' },
  { date: '2026-07-29', titleJa: 'FOMC政策金利発表', region: 'US', importance: 'high' },
  { date: '2026-07-29', titleJa: '米GDP速報値発表', region: 'US', importance: 'medium' },
  { date: '2026-07-30', titleJa: '日銀金融政策決定会合', region: 'JP', importance: 'high' },

  // August 2026
  { date: '2026-08-07', titleJa: '米雇用統計(非農業部門雇用者数)発表', region: 'US', importance: 'high' },
  { date: '2026-08-12', titleJa: '米CPI(消費者物価指数)発表', region: 'US', importance: 'high' },
  { date: '2026-08-17', titleJa: '日本GDP速報値発表', region: 'JP', importance: 'medium' },

  // September 2026
  { date: '2026-09-04', titleJa: '米雇用統計(非農業部門雇用者数)発表', region: 'US', importance: 'high' },
  { date: '2026-09-09', titleJa: '米CPI(消費者物価指数)発表', region: 'US', importance: 'high' },
  { date: '2026-09-10', titleJa: 'ECB理事会(政策金利決定)', region: 'EU', importance: 'high' },
  { date: '2026-09-16', titleJa: 'FOMC政策金利発表', region: 'US', importance: 'high' },
  { date: '2026-09-22', titleJa: '日銀金融政策決定会合', region: 'JP', importance: 'high' },

  // October 2026
  { date: '2026-10-02', titleJa: '米雇用統計(非農業部門雇用者数)発表', region: 'US', importance: 'high' },
  { date: '2026-10-13', titleJa: '米CPI(消費者物価指数)発表', region: 'US', importance: 'high' },
  { date: '2026-10-22', titleJa: 'ECB理事会(政策金利決定)', region: 'EU', importance: 'high' },
  { date: '2026-10-28', titleJa: '米GDP速報値発表', region: 'US', importance: 'medium' },
  { date: '2026-10-29', titleJa: '日銀金融政策決定会合', region: 'JP', importance: 'high' },

  // November 2026
  { date: '2026-11-04', titleJa: 'FOMC政策金利発表', region: 'US', importance: 'high' },
  { date: '2026-11-06', titleJa: '米雇用統計(非農業部門雇用者数)発表', region: 'US', importance: 'high' },
  { date: '2026-11-12', titleJa: '米CPI(消費者物価指数)発表', region: 'US', importance: 'high' },
  { date: '2026-11-16', titleJa: '日本GDP速報値発表', region: 'JP', importance: 'medium' },

  // December 2026
  { date: '2026-12-04', titleJa: '米雇用統計(非農業部門雇用者数)発表', region: 'US', importance: 'high' },
  { date: '2026-12-10', titleJa: '米CPI(消費者物価指数)発表', region: 'US', importance: 'high' },
  { date: '2026-12-10', titleJa: 'ECB理事会(政策金利決定)', region: 'EU', importance: 'high' },
  { date: '2026-12-16', titleJa: 'FOMC政策金利発表', region: 'US', importance: 'high' },
  { date: '2026-12-18', titleJa: '日銀金融政策決定会合', region: 'JP', importance: 'high' },
];
