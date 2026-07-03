import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { TYPES } from './MemoryTypeSelector';
import { formatPrice, formatDate, formatDateShort } from '../utils/formatters';

const TYPE_COLORS = {
  DDR4: '#3b82f6',
  DDR5: '#8b5cf6',
  NAND: '#10b981',
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 shadow-xl">
      <p className="text-gray-400 text-sm mb-2">{formatDate(label)}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-300">{entry.dataKey}:</span>
          <span className="font-semibold text-white">
            {formatPrice(entry.value)}/GB
          </span>
        </div>
      ))}
    </div>
  );
}

export default function PriceChart({ data, activeTypes, view }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-900 rounded-xl border border-gray-800">
        <p className="text-gray-500">No data available for this view</p>
      </div>
    );
  }

  // Check if NAND is the only active type (its scale is much smaller)
  const hasOnlyNand =
    activeTypes.length === 1 && activeTypes[0] === 'NAND';
  const hasDramAndNand =
    activeTypes.includes('NAND') &&
    (activeTypes.includes('DDR4') || activeTypes.includes('DDR5'));

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <ResponsiveContainer width="100%" height={450}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateShort}
            stroke="#6b7280"
            tick={{ fontSize: 12 }}
            interval="preserveStartEnd"
            minTickGap={60}
          />
          <YAxis
            stroke="#6b7280"
            tick={{ fontSize: 12 }}
            tickFormatter={(v) => `$${v}`}
            domain={['auto', 'auto']}
          />
          {hasDramAndNand && (
            <YAxis
              yAxisId="nand"
              orientation="right"
              stroke="#10b981"
              tick={{ fontSize: 12 }}
              tickFormatter={(v) => `$${v}`}
              domain={['auto', 'auto']}
            />
          )}
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            formatter={(value) => (
              <span className="text-gray-300 text-sm">{value} ($/GB)</span>
            )}
          />
          {activeTypes
            .filter((t) => t !== 'NAND')
            .map((type) => (
              <Line
                key={type}
                type="monotone"
                dataKey={type}
                stroke={TYPE_COLORS[type]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: TYPE_COLORS[type] }}
                connectNulls
              />
            ))}
          {activeTypes.includes('NAND') && (
            <Line
              type="monotone"
              dataKey="NAND"
              stroke={TYPE_COLORS.NAND}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: TYPE_COLORS.NAND }}
              connectNulls
              yAxisId={hasDramAndNand ? 'nand' : undefined}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
