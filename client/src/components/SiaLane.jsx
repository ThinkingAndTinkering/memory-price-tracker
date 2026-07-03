import React from 'react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { formatMonth, formatSignedPct } from '../utils/formatters';

export default function SiaLane({ data }) {
  if (!data || !data.length) return <div className="text-gray-500 text-sm py-8 text-center">No billings data.</div>;
  const last = data[data.length - 1];
  return (
    <div>
      <div className="text-sm text-gray-400 mb-2">
        Latest: <span className="font-mono text-gray-200">${last.billings_usd_b}B</span>
        {last.yoy_pct != null && <> · <span className="text-emerald-300">{last.yoy_pct > 0 ? '+' : ''}{last.yoy_pct}% YoY</span></>}
        <span className="text-gray-600"> ({formatMonth(last.date)}, 3-mo avg)</span>
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="date" tickFormatter={formatMonth} stroke="#6b7280" tick={{ fontSize: 11 }} minTickGap={40} />
          <YAxis yAxisId="b" stroke="#6b7280" tick={{ fontSize: 11 }} width={44} tickFormatter={(v) => `$${v}`} />
          <YAxis yAxisId="y" orientation="right" stroke="#475569" tick={{ fontSize: 11 }} width={40} tickFormatter={(v) => `${v}%`} />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelFormatter={formatMonth}
            formatter={(v, n) =>
              v == null ? ['—', n] : n === 'YoY %' ? [formatSignedPct(v), n] : [`$${v}B`, n]
            }
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="y" dataKey="yoy_pct" name="YoY %" fill="#334155" radius={[2, 2, 0, 0]} />
          <Line yAxisId="b" type="monotone" dataKey="billings_usd_b" name="Billings ($B)" stroke="#94a3b8" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
