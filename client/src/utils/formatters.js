export function formatPrice(price) {
  if (!Number.isFinite(price)) return '-';
  if (price < 0.01) return `$${price.toFixed(4)}`;
  if (price < 1) return `$${price.toFixed(3)}`;
  return `$${price.toFixed(2)}`;
}

export function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatDateShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-US', {
    year: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });
}

export function formatMonth(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', timeZone: 'UTC' });
}

// signed percent from a fraction, e.g. 0.123 -> "+12.3%"
export function formatPct(frac, digits = 1) {
  if (frac == null || isNaN(frac)) return '—';
  const pct = frac * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(digits)}%`;
}

// signed percent from an already-percent value, e.g. 18.5 -> "+18.5%"
export function formatSignedPct(pct, digits = 1) {
  if (pct == null || isNaN(pct)) return '—';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(digits)}%`;
}
