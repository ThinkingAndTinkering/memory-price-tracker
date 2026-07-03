import React from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
} from 'recharts';
import { formatMonth, formatSignedPct } from '../utils/formatters';

const KIND_COLOR = { contract: '#34d399', outlook: '#60a5fa', earnings: '#fbbf24', spot: '#f472b6' };

// pivot clean per-quarter contract rows into {quarter, DRAM, NAND}
function pivotContract(events) {
  const byDate = new Map();
  for (const e of events) {
    if (e.kind !== 'contract') continue;
    if (!byDate.has(e.date)) byDate.set(e.date, { date: e.date });
    byDate.get(e.date)[e.product] = e.magnitude_pct;
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function quarterLabel(date) {
  const d = new Date(date + 'T00:00:00Z');
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `Q${q} ${String(d.getUTCFullYear()).slice(2)}`;
}

export default function ContractLane({ events }) {
  if (!events || !events.length) return <div className="text-gray-500 text-sm py-8 text-center">No contract events.</div>;
  const bars = pivotContract(events);
  // Articles currently coming from the live TrendForce RSS scrape (vs the curated seed baseline).
  const liveUrls = new Set(events.filter((e) => e.source === 'TrendForce-RSS').map((e) => e.url));
  // One row per article: the curated seed and the RSS auto-scraper can both surface the same
  // press release, so dedup by URL, preferring the row that carries a magnitude figure.
  const byUrl = new Map();
  for (const e of events) {
    const key = e.url || e.headline || e.id;
    const ex = byUrl.get(key);
    if (!ex || (e.magnitude_pct != null && ex.magnitude_pct == null)) byUrl.set(key, e);
  }
  const timeline = [...byUrl.values()].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="grid lg:grid-cols-[1.1fr_1fr] gap-6">
      <div>
        <div className="text-sm text-gray-400 mb-2">Quarter-over-quarter contract price change</div>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={bars} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="date" tickFormatter={quarterLabel} stroke="#6b7280" tick={{ fontSize: 11 }} />
            <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} width={40} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              formatter={(v, n) => [formatSignedPct(v) + ' QoQ', n]}
              labelFormatter={quarterLabel}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="DRAM" fill="#34d399" radius={[3, 3, 0, 0]} />
            <Bar dataKey="NAND" fill="#a78bfa" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Press-release timeline</span>
          <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE = auto-scraped now · unbadged = curated
          </span>
        </div>
        <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
          {timeline.map((e, i) => (
            <a
              key={e.id ?? `${e.date}-${e.kind}-${e.product}-${i}`} href={e.url} target="_blank" rel="noreferrer"
              className="block rounded-lg border border-gray-800 bg-gray-900/60 hover:bg-gray-800/60 px-3 py-2 transition-colors"
            >
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500 font-mono">{formatMonth(e.date)}</span>
                {liveUrls.has(e.url) && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-emerald-300 bg-emerald-400/15 font-semibold uppercase tracking-wide">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />live
                  </span>
                )}
                <span className="px-1.5 py-0.5 rounded" style={{ color: KIND_COLOR[e.kind] || '#94a3b8', background: (KIND_COLOR[e.kind] || '#94a3b8') + '1f' }}>
                  {e.kind}
                </span>
                <span className="text-gray-400">{e.product}</span>
                {e.magnitude_pct != null && (
                  <span className="ml-auto font-mono text-gray-300">{formatSignedPct(e.magnitude_pct)}</span>
                )}
              </div>
              <div className="text-sm text-gray-300 mt-1 leading-snug">{e.headline}</div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
