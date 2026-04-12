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
  if (previous === null) return null;
  const diff = current - previous;
  const pct = ((diff / previous) * 100).toFixed(2);
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
