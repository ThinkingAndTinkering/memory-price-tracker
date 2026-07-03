import React from 'react';

const VIEWS = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly (5Y)' },
  { key: 'monthly', label: 'Monthly (10Y)' },
];

export default function TimeRangeSelector({ view, onViewChange }) {
  return (
    <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
      {VIEWS.map((v) => (
        <button
          key={v.key}
          onClick={() => onViewChange(v.key)}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            view === v.key
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
          }`}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
