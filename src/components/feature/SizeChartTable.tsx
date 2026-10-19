import { useState } from 'react';
import { toInches, type SizeChart } from '../../domain/sizeChart';

interface SizeChartTableProps {
  chart: SizeChart;
}

export default function SizeChartTable({ chart }: SizeChartTableProps) {
  const [sizeUnit, setSizeUnit] = useState<'cm' | 'inch'>('cm');
  const hasCm = chart.columns.some((column) => column.unit === 'cm');

  const unitLabel = (unit?: string) => {
    if (!unit) return '';
    if (unit === 'cm' && sizeUnit === 'inch') return ' (inch)';
    return ` (${unit})`;
  };

  return (
    <div className="space-y-4" data-testid="size-chart-table">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          {chart.note ||
            '尺寸為參考範圍，實際貼合度依身形與布料彈性而異；介於兩個尺碼之間時，請以選項上標示的建議體重為準。'}
        </p>
        {hasCm && (
          <div className="flex items-center bg-gray-100 p-1 rounded-xl w-fit shrink-0">
            <button
              type="button"
              onClick={() => setSizeUnit('cm')}
              aria-pressed={sizeUnit === 'cm'}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${sizeUnit === 'cm' ? 'bg-white text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
            >
              公分 (cm)
            </button>
            <button
              type="button"
              onClick={() => setSizeUnit('inch')}
              aria-pressed={sizeUnit === 'inch'}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${sizeUnit === 'inch' ? 'bg-white text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
            >
              英吋 (inch)
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-left text-sm text-gray-700">
          <thead className="bg-gray-100/80 text-xs font-bold text-gray-700">
            <tr>
              <th className="px-5 py-3.5 whitespace-nowrap">尺碼</th>
              {chart.columns.map((column) => (
                <th key={column.label} className="px-5 py-3.5 whitespace-nowrap">
                  {`${column.label}${unitLabel(column.unit)}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {chart.rows.map((row, idx) => (
              <tr key={row.size || idx} className={idx % 2 === 1 ? 'bg-gray-50/40' : ''}>
                <td className="px-5 py-4 font-bold text-brand whitespace-nowrap">{row.size}</td>
                {chart.columns.map((column, colIdx) => {
                  const value = row.values[colIdx] || '-';
                  return (
                    <td key={column.label} className="px-5 py-4 whitespace-nowrap">
                      {column.unit === 'cm' && sizeUnit === 'inch' ? toInches(value) : value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
