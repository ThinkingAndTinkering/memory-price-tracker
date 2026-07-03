import React, { useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { formatDateShort, formatDate } from '../utils/formatters';

function Tip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm shadow-xl">
      <div className="text-gray-400">{formatDate(label)}</div>
      <div className="text-amber-300 font-semibold">Index {Math.round(payload[0].value)}</div>
    </div>
  );
}

export default function EquityLane({ data }) {
  const [log, setLog] = useState(true);
  if (!data || !data.series || !data.series.length) {
    return <div className="text-gray-500 text-sm py-10 text-center">No equity data yet.</div>;
  }
  const last = data.series[data.series.length - 1];
  const constituents = data.constituents || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="text-sm text-gray-400">
          Basket rebased to <span className="font-mono text-gray-200">100</span> at start ·
          now <span className="font-mono text-amber-300">{Math.round(last.value)}</span>
        </div>
        <button
          onClick={() => setLog((v) => !v)}
          className="text-xs px-2.5 py-1 rounded bg-gray-800 text-gray-300 hover:bg-gray-700"
        >
          {log ? 'Log scale' : 'Linear scale'}
        </button>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data.series} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="date" tickFormatter={formatDateShort} stroke="#6b7280" tick={{ fontSize: 11 }} minTickGap={60} />
          <YAxis
            scale={log ? 'log' : 'auto'} domain={log ? ['auto', 'auto'] : [0, 'auto']}
            stroke="#6b7280" tick={{ fontSize: 11 }} width={44}
            tickFormatter={(v) => Math.round(v)} allowDataOverflow
          />
          <Tooltip content={<Tip />} />
          <Line type="monotone" dataKey="value" stroke="#fbbf24" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-2 mt-3">
        {constituents.map((c) => (
          <span key={c.ticker} className="text-xs px-2 py-1 rounded bg-gray-800/70 text-gray-400" title={`${c.segment} · weight ${c.weight}`}>
            <span className="text-gray-200 font-medium">{c.name}</span> <span className="text-gray-600">·{c.weight}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
