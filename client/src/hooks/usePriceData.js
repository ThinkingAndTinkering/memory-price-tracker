import { useState, useEffect } from 'react';

const API_BASE = '/api/prices';

export function usePriceData(view, types) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const endpoint =
      view === 'weekly'
        ? `${API_BASE}/weekly`
        : view === 'monthly'
          ? `${API_BASE}/monthly`
          : `${API_BASE}/daily`;

    fetch(endpoint)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((rows) => {
        if (cancelled) return;
        setData(Array.isArray(rows) ? rows : []); // guard: error envelopes are not iterable
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [view]);

  // Pivot data: group by date with columns per memory type
  const chartData = pivotData(data, types);

  return { data, chartData, loading, error };
}

export function useLatestPrices() {
  const [prices, setPrices] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE}/latest`)
      .then((res) => res.json())
      .then(setPrices)
      .catch(console.error);
  }, []);

  return prices;
}

function pivotData(rows, activeTypes) {
  const dateMap = new Map();

  for (const row of rows) {
    if (!activeTypes.includes(row.memory_type)) continue;

    if (!dateMap.has(row.date)) {
      dateMap.set(row.date, { date: row.date });
    }
    const entry = dateMap.get(row.date);
    entry[row.memory_type] = row.price_per_gb;
    entry[`${row.memory_type}_source`] = row.source;
  }

  return Array.from(dateMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}
