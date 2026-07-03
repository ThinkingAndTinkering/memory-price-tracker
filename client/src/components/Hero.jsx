import React from 'react';
import MpdiGauge from './MpdiGauge';
import { CYCLE_PHASES, BUY_TIER_COLORS } from '../lib/laneInfo';

function CycleBadge({ cycle }) {
  if (!cycle || !cycle.phase) return null;
  const meta = CYCLE_PHASES[cycle.phase] || {};
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: meta.color + '55', background: meta.color + '12' }}>
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: meta.color }} />
        <span className="text-xs uppercase tracking-widest text-gray-400">Cycle position</span>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-bold" style={{ color: meta.color }}>{meta.label}</span>
        <span className="text-xs uppercase tracking-wide text-gray-500">{cycle.strength}</span>
      </div>
      <p className="mt-1.5 text-sm text-gray-400 leading-snug">{meta.blurb}</p>
    </div>
  );
}

// Pick the most representative buyer headline for the chip (the broadest WAIT or BUY).
function buyerSummary(buySignal) {
  if (!buySignal || !buySignal.length) return null;
  const order = { WAIT: 5, 'LEAN WAIT': 4, FAIR: 3, 'LEAN BUY': 2, BUY: 1, UNKNOWN: 0 };
  const valid = buySignal.filter((s) => s && s.verdict && s.verdict.tier);
  if (!valid.length) return null;
  const sorted = [...valid].sort((a, b) => (order[b.verdict.tier] || 0) - (order[a.verdict.tier] || 0));
  return sorted[0];
}

export default function Hero({ composite, cycle, buySignal }) {
  const c = composite || {};
  const buyer = buyerSummary(buySignal);
  const headline = c.headline || 'Awaiting data…';

  return (
    <section className="rounded-2xl border border-gray-800 bg-gradient-to-b from-gray-900 to-gray-950 p-6 sm:p-8">
      <div className="grid lg:grid-cols-[340px_1fr] gap-8 items-center">
        <div className="flex flex-col items-center">
          <span className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-1">Memory Price Direction Index</span>
          <MpdiGauge value={c.mpdi} zone={c.zone} delta={c.delta_mom} />
        </div>

        <div className="space-y-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">{headline}</h2>
            <p className="text-gray-500 text-sm mt-1">
              One number for the whole memory cycle — a weighted blend of the four lanes below.
              {c.date && <> Updated {c.date}.</>}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <CycleBadge cycle={cycle} />
            {buyer && (
              <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: BUY_TIER_COLORS[buyer.verdict.tier] }} />
                  <span className="text-xs uppercase tracking-widest text-gray-400">Buyer’s call</span>
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold" style={{ color: BUY_TIER_COLORS[buyer.verdict.tier] }}>
                    {buyer.verdict.tier}
                  </span>
                  <span className="text-xs text-gray-500">most products</span>
                </div>
                <p className="mt-1.5 text-sm text-gray-400 leading-snug">{buyer.verdict.label}.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
