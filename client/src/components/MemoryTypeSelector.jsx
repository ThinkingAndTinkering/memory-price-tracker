import React from 'react';

const TYPES = [
  { key: 'DDR4', color: '#3b82f6', label: 'DDR4' },
  { key: 'DDR5', color: '#8b5cf6', label: 'DDR5' },
  { key: 'NAND', color: '#10b981', label: 'NAND' },
];

export default function MemoryTypeSelector({ activeTypes, onToggle }) {
  return (
    <div className="flex gap-2">
      {TYPES.map((t) => {
        const active = activeTypes.includes(t.key);
        return (
          <button
            key={t.key}
            onClick={() => onToggle(t.key)}
            aria-pressed={active}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              active ? 'bg-gray-800' : 'bg-gray-800/50 text-gray-500 hover:text-gray-300'
            }`}
            style={active ? { boxShadow: `0 0 0 2px ${t.color}` } : undefined}
          >
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: active ? t.color : '#4b5563' }}
            />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export { TYPES };
