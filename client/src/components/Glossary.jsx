import React from 'react';
import { GLOSSARY, SOURCES } from '../lib/laneInfo';

export default function Glossary() {
  return (
    <details className="rounded-xl border border-gray-800 bg-gray-900 p-5 sm:p-6 group">
      <summary className="cursor-pointer list-none flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Methodology &amp; glossary</h3>
        <span className="text-gray-500 text-sm group-open:rotate-180 transition-transform">▾</span>
      </summary>
      <div className="mt-4 grid md:grid-cols-2 gap-x-8 gap-y-4">
        {GLOSSARY.map((g) => (
          <div key={g.term}>
            <h4 className="text-sm font-semibold text-gray-200">{g.term}</h4>
            <p className="text-sm text-gray-500 leading-snug mt-0.5">{g.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 pt-4 border-t border-gray-800">
        <h4 className="text-xs uppercase tracking-widest text-gray-500 mb-2">Free data sources</h4>
        <div className="flex flex-wrap gap-2">
          {SOURCES.map((s) => (
            <span key={s.name} className="text-xs px-2 py-1 rounded bg-gray-800/70 text-gray-400" title={s.note}>
              {s.name}
            </span>
          ))}
        </div>
        <p className="text-xs text-gray-600 mt-3 leading-snug">
          No paid feeds. Contract-price <em>levels</em> ($/unit) are proprietary to TrendForce/DRAMeXchange; this monitor
          uses their free press-release <em>direction</em> (QoQ %) as the truth anchor. Pre-live history is interpolated
          from dated market anchors and labelled “estimated”; live points come from the scrapers above.
        </p>
      </div>
    </details>
  );
}
