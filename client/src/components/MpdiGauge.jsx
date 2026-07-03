import React from 'react';
import { mpdiColor } from '../lib/laneInfo';

// Semicircle 0–100 gauge drawn directly in SVG for full control.
const ZONES = [
  [0, 35, '#3b82f6'],
  [35, 45, '#38bdf8'],
  [45, 55, '#94a3b8'],
  [55, 65, '#f59e0b'],
  [65, 100, '#ef4444'],
];

function polar(cx, cy, r, value) {
  const theta = Math.PI * (1 - value / 100); // v=0 -> 180°, v=100 -> 0°
  return { x: cx + r * Math.cos(theta), y: cy - r * Math.sin(theta) };
}

function arc(cx, cy, r, v0, v1) {
  const p0 = polar(cx, cy, r, v0);
  const p1 = polar(cx, cy, r, v1);
  return `M ${p0.x} ${p0.y} A ${r} ${r} 0 0 1 ${p1.x} ${p1.y}`;
}

export default function MpdiGauge({ value, zone, delta }) {
  const W = 320;
  const H = 188;
  const cx = W / 2;
  const cy = 168;
  const r = 130;
  const v = value == null ? 50 : value;
  const needle = polar(cx, cy, r - 16, v);
  const color = mpdiColor(value);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[340px]" role="img"
      aria-label={`MPDI ${value == null ? 'unavailable' : Math.round(value)}${zone ? ', ' + zone.replace('-', ' ') : ''}`}
    >
      {/* zone track */}
      {ZONES.map(([a, b, c]) => (
        <path key={a} d={arc(cx, cy, r, a, b)} stroke={c} strokeWidth={16} fill="none" opacity={0.32} strokeLinecap="butt" />
      ))}
      {/* active value arc — omitted entirely when there is no value, so missing data
          never renders as a concrete-looking half-filled (50) gauge */}
      {value != null && (
        <path d={arc(cx, cy, r, 0, v)} stroke={color} strokeWidth={16} fill="none" strokeLinecap="round" />
      )}
      {/* ticks at 35/50/65 */}
      {[35, 50, 65].map((t) => {
        const o = polar(cx, cy, r + 9, t);
        const i = polar(cx, cy, r - 9, t);
        return <line key={t} x1={i.x} y1={i.y} x2={o.x} y2={o.y} stroke="#475569" strokeWidth={1.5} />;
      })}
      {/* needle */}
      {value != null && (
        <>
          <line x1={cx} y1={cy} x2={needle.x} y2={needle.y} stroke={color} strokeWidth={3} strokeLinecap="round" />
          <circle cx={cx} cy={cy} r={6} fill={color} />
        </>
      )}
      {/* labels */}
      <text x={polar(cx, cy, r, 0).x - 2} y={cy + 16} fill="#64748b" fontSize={11} textAnchor="middle">0</text>
      <text x={polar(cx, cy, r, 100).x + 2} y={cy + 16} fill="#64748b" fontSize={11} textAnchor="middle">100</text>
      <text x={cx} y={cy - 56} fill={color} fontSize={52} fontWeight={800} textAnchor="middle" fontFamily="ui-monospace, monospace">
        {value == null ? '—' : Math.round(value)}
      </text>
      <text x={cx} y={cy - 30} fill="#94a3b8" fontSize={12} textAnchor="middle" letterSpacing="1.5" style={{ textTransform: 'uppercase' }}>
        {(zone || '').replace('-', ' ')}
      </text>
      {delta != null && (
        <text x={cx} y={cy - 12} fill={delta > 0 ? '#fca5a5' : delta < 0 ? '#7dd3fc' : '#94a3b8'} fontSize={11} textAnchor="middle">
          {delta > 0 ? '▲' : delta < 0 ? '▼' : '■'} {delta > 0 ? '+' : ''}{delta.toFixed(1)} MoM
        </text>
      )}
    </svg>
  );
}
