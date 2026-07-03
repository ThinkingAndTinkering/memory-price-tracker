import React from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ReferenceArea,
} from 'recharts';
import { formatMonth } from '../utils/formatters';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 shadow-xl text-sm">
      <div className="text-gray-400">{formatMonth(label)}</div>
      <div className="text-white font-semibold">MPDI {p.mpdi}</div>
      <div className="text-gray-500 text-xs mt-1">
        z: eq {fmt(p.zEquity)} · con {fmt(p.zContract)} · ret {fmt(p.zRetail)} · sia {fmt(p.zSIA)}
      </div>
    </div>
  );
}
const fmt = (x) => (x == null ? '—' : x.toFixed(1));

export default function CompositeHistory({ series }) {
  if (!series || !series.length) return null;
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 sm:p-6">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold text-white">Composite history — MPDI</h3>
          <p className="text-sm text-gray-500">The cycle heat gauge over time. Above 65 = rising hard; below 35 = falling hard.</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={series} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="mpdiFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.55} />
              <stop offset="50%" stopColor="#f59e0b" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <ReferenceArea y1={65} y2={100} fill="#ef4444" fillOpacity={0.05} />
          <ReferenceArea y1={0} y2={35} fill="#3b82f6" fillOpacity={0.05} />
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="date" tickFormatter={formatMonth} stroke="#6b7280" tick={{ fontSize: 11 }} minTickGap={50} />
          <YAxis domain={[0, 100]} stroke="#6b7280" tick={{ fontSize: 11 }} ticks={[0, 35, 50, 65, 100]} />
          <ReferenceLine y={50} stroke="#475569" strokeDasharray="4 4" />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="mpdi" stroke="#f59e0b" strokeWidth={2.5} fill="url(#mpdiFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
