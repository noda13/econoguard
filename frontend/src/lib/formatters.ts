export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ja-JP', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatChange(current: number, previous: number | null): { text: string; isPositive: boolean } | null {
  // Guard: null or zero previous makes percent change undefined/infinite
  if (previous === null || previous === 0) return null;
  const diff = current - previous;
  const ratio = (diff / previous) * 100;
  // Extra safety: reject non-finite results (e.g. subnormal floats)
  if (!Number.isFinite(ratio)) return null;
  const pct = ratio.toFixed(2);
  return {
    text: `${diff > 0 ? '+' : ''}${pct}%`,
    isPositive: diff > 0,
  };
}

export function formatNumber(value: number, decimals = 2): string {
  return value.toLocaleString('ja-JP', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
