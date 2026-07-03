import React from 'react';

// Wrapper for a data lane: a coloured tag (LEADING / TRUTH ANCHOR / LAGGING /
// BACKDROP), a title, the 1–2 sentence literacy explainer, then the chart.
export default function LaneCard({ lane, right, children }) {
  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span
            className="text-[10px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded"
            style={{ color: lane.tagColor, background: lane.tagColor + '1f' }}
          >
            {lane.tag}
          </span>
          <h3 className="text-lg font-semibold text-white">{lane.title}</h3>
        </div>
        {right}
      </div>
      <p className="text-sm text-gray-500 leading-snug mb-4 max-w-3xl">{lane.explainer}</p>
      {children}
    </section>
  );
}
