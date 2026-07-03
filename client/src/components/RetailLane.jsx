import React, { useState } from 'react';
import TimeRangeSelector from './TimeRangeSelector';
import MemoryTypeSelector from './MemoryTypeSelector';
import PriceChart from './PriceChart';
import { usePriceData } from '../hooks/usePriceData';

export default function RetailLane() {
  const [view, setView] = useState('monthly');
  const [activeTypes, setActiveTypes] = useState(['DDR4', 'DDR5', 'NAND']);
  const { chartData, loading, error } = usePriceData(view, activeTypes);

  function toggleType(type) {
    setActiveTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <MemoryTypeSelector activeTypes={activeTypes} onToggle={toggleType} />
        <TimeRangeSelector view={view} onViewChange={setView} />
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-80 text-gray-500">Loading…</div>
      ) : error ? (
        <div className="flex items-center justify-center h-80 text-red-400">Error: {error}</div>
      ) : (
        <PriceChart data={chartData} activeTypes={activeTypes} view={view} />
      )}
      <div className="flex gap-4 text-xs text-gray-600 mt-3">
        <span><span className="text-yellow-600">*</span> estimated (interpolated history)</span>
        <span>solid = live scraped (Newegg / diskprices)</span>
      </div>
    </div>
  );
}
