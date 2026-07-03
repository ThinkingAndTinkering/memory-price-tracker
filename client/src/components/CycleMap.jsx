import React from 'react';
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip,
  ReferenceArea, ReferenceLine, Cell,
} from 'recharts';
import { CYCLE_PHASES } from '../lib/laneInfo';

// x = price level percentile (cheap -> expensive), y = direction/heat (MPDI - 50).
// Quadrants: expensive+rising = boom, expensive+falling = peak,
//            cheap+falling = bust, cheap+rising = trough.
export default function CycleMap({ composite, cycle }) {
  if (!composite || composite.mpdi == null || !cycle || cycle.inputs == null) return null;
  const x = cycle.inputs.P;
  const y = Math.round((composite.mpdi - 50) * 10) / 10;
  const meta = CYCLE_PHASES[cycle.phase] || {};
  const point = [{ x, y, phase: cycle.phase }];

  const quad = (x1, x2, y1, y2, key, label, dx, dy, anchor) => (
    <ReferenceArea x1={x1} x2={x2} y1={y1} y2={y2} fill={CYCLE_PHASES[key].color} fillOpacity={0.06}
      label={{ value: label, position: 'insideTopLeft', fill: CYCLE_PHASES[key].color, fontSize: 12, dx, dy, textAnchor: anchor }} />
  );

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 sm:p-6">
      <h3 className="text-lg font-semibold text-white">Cycle map — where are we?</h3>
      <p className="text-sm text-gray-500 mb-3 max-w-2xl">
        Price level (cheap → expensive) against direction (falling → rising). The dot is today.
        A true top sits bottom-right (expensive but rolling over); a bottom sits top-left (cheap but turning up).
      </p>
      <ResponsiveContainer width="100%" height={320}>
        <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          {quad(50, 100, 0, 50, 'boom', 'BOOM', 8, 14)}
          {quad(50, 100, -50, 0, 'peak', 'PEAK', 8, 14)}
          {quad(0, 50, -50, 0, 'bust', 'BUST', 8, 14)}
          {quad(0, 50, 0, 50, 'trough', 'TROUGH', 8, 14)}
          <ReferenceLine x={50} stroke="#475569" />
          <ReferenceLine y={0} stroke="#475569" />
          <XAxis type="number" dataKey="x" name="Price level" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]}
            stroke="#6b7280" tick={{ fontSize: 11 }} label={{ value: 'cheap  →  expensive (percentile)', position: 'bottom', fill: '#64748b', fontSize: 11, dy: 8 }} />
          <YAxis type="number" dataKey="y" name="Direction" domain={[-50, 50]} ticks={[-50, -25, 0, 25, 50]}
            stroke="#6b7280" tick={{ fontSize: 11 }} width={40} label={{ value: 'falling ↑ rising', angle: -90, position: 'left', fill: '#64748b', fontSize: 11, dx: 18 }} />
          <ZAxis range={[400, 400]} />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            formatter={(v, n) => [Math.round(v), n]}
          />
          <Scatter data={point}>
            <Cell fill={meta.color} stroke="#fff" strokeWidth={2} />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <div className="text-xs text-gray-500 mt-1">
        Now: <span style={{ color: meta.color }} className="font-semibold">{meta.label}</span> · level {x}th pct · MPDI {composite.mpdi}
      </div>
    </div>
  );
}
