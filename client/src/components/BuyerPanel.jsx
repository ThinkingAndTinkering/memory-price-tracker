import React from 'react';
import { BUY_TIER_COLORS, TYPE_COLORS } from '../lib/laneInfo';
import { formatPrice, formatPct } from '../utils/formatters';

function Row({ s }) {
  const color = BUY_TIER_COLORS[s.verdict.tier] || '#64748b';
  const pct = s.P24 == null ? 0 : s.P24;
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: TYPE_COLORS[s.product] }} />
          <span className="font-semibold text-white">{s.product}</span>
          <span className="text-sm text-gray-500 font-mono">{formatPrice(s.current_per_gb)}/GB</span>
        </div>
        <span className="text-sm font-bold px-2 py-0.5 rounded" style={{ color, background: color + '1f' }}>
          {s.verdict.tier}
        </span>
      </div>

      {/* percentile track */}
      <div className="relative h-2.5 rounded-full bg-gray-800 overflow-hidden">
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="flex justify-between text-[10px] text-gray-600 mt-1">
        <span>2-yr low</span><span>2-yr high</span>
      </div>

      <p className="text-sm text-gray-400 mt-2 leading-snug">{s.verdict.label}.</p>
      <div className="text-xs text-gray-500 mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <span>{s.P24}th pct of 24mo</span>
        <span>3-mo move {formatPct(s.d3)}</span>
        {s.fair_ref != null && <span>fair ≈ {formatPrice(s.fair_ref)}/GB</span>}
        {s.headroom != null && <span>{formatPct(s.headroom)} vs fair</span>}
      </div>
      {!s.enoughHistory && <p className="text-[11px] text-amber-600 mt-1">Limited history — read with caution.</p>}
    </div>
  );
}

export default function BuyerPanel({ data }) {
  if (!data || !data.length) return null;
  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900 p-5 sm:p-6">
      <div className="flex items-center gap-2.5 mb-1">
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded text-sky-300 bg-sky-300/10">BUYER</span>
        <h3 className="text-lg font-semibold text-white">Should you buy now or wait?</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4 max-w-3xl">
        Each product’s current retail $/GB ranked against its own trailing two years, blended with 3-month momentum.
        Near 2-year lows → buy; near 2-year highs → wait.
      </p>
      <div className="grid sm:grid-cols-3 gap-3">
        {data.map((s) => <Row key={s.product} s={s} />)}
      </div>
    </section>
  );
}
