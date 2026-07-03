import React, { useState, useMemo } from 'react';
import { formatPrice, formatDate } from '../utils/formatters';

export default function PriceTable({ data, activeTypes }) {
  const [sortField, setSortField] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(0);
  const perPage = 20;

  const sorted = useMemo(() => {
    const rows = [...data];
    rows.sort((a, b) => {
      const aVal = a[sortField] ?? '';
      const bVal = b[sortField] ?? '';
      if (sortDir === 'asc') return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    });
    return rows;
  }, [data, sortField, sortDir]);

  const totalPages = Math.ceil(sorted.length / perPage);
  const pageData = sorted.slice(page * perPage, (page + 1) * perPage);

  function handleSort(field) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
    setPage(0);
  }

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span className="text-gray-600 ml-1">⇕</span>;
    return <span className="text-blue-400 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th
                className="text-left px-6 py-3 text-gray-400 font-medium cursor-pointer hover:text-gray-200"
                onClick={() => handleSort('date')}
              >
                Date <SortIcon field="date" />
              </th>
              {activeTypes.map((type) => (
                <th
                  key={type}
                  className="text-right px-6 py-3 text-gray-400 font-medium cursor-pointer hover:text-gray-200"
                  onClick={() => handleSort(type)}
                >
                  {type} ($/GB) <SortIcon field={type} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((row) => (
              <tr
                key={row.date}
                className="border-b border-gray-800/50 hover:bg-gray-800/30"
              >
                <td className="px-6 py-3 text-gray-300">
                  {formatDate(row.date)}
                </td>
                {activeTypes.map((type) => (
                  <td key={type} className="text-right px-6 py-3">
                    {row[type] != null ? (
                      <span className="text-white font-mono">
                        {formatPrice(row[type])}
                      </span>
                    ) : (
                      <span className="text-gray-600">-</span>
                    )}
                    {row[`${type}_source`] === 'estimated' && row[type] != null && (
                      <span className="text-yellow-600 text-xs ml-1" title="Estimated">*</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-800">
          <span className="text-gray-500 text-sm">
            {sorted.length} rows &middot; Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 rounded bg-gray-800 text-gray-300 text-sm disabled:opacity-30 hover:bg-gray-700"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1 rounded bg-gray-800 text-gray-300 text-sm disabled:opacity-30 hover:bg-gray-700"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
