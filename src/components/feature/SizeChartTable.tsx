import { useState } from 'react';
import type { SizeChartItem } from '../../lib/shopify';

// 內衣尺碼表沿用內褲的 waist／hips／crotch 欄位存放下胸圍、罩杯與支撐感（Shopify custom.size_chart），
// 依內容判斷欄名，避免「腰圍」欄出現下胸圍。
function getColumns(rows: SizeChartItem[]) {
  const isBra = rows.some((row) => row.waist?.includes('下胸圍') || row.hips?.includes('罩杯'));
  if (isBra) {
    return {
      isBra,
      labels: ['下胸圍', '建議罩杯', '支撐感'],
      // 內衣欄位內已帶單位與前綴文字，移除重複的前綴即可
      strip: (value: string) => value.replace(/^(下胸圍|建議罩杯)\s*/, ''),
    };
  }
  return { isBra, labels: ['腰圍', '臀圍', '襠深'], strip: (value: string) => value };
}

const formatSizeValue = (val: string, unit: 'cm' | 'inch') => {
  if (!val || val === '-') return '-';
  if (unit === 'cm') return val;
  return val.replace(/\b(\d+(?:\.\d+)?)\b/g, (match) => {
    const num = parseFloat(match);
    if (isNaN(num)) return match;
    return (num * 0.3937).toFixed(1);
  });
};

interface SizeChartTableProps {
  rows: SizeChartItem[];
}

export default function SizeChartTable({ rows }: SizeChartTableProps) {
  const [sizeUnit, setSizeUnit] = useState<'cm' | 'inch'>('cm');
  const { isBra, labels, strip } = getColumns(rows);

  return (
    <div className="space-y-4" data-testid="size-chart-table">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          尺寸為參考範圍，實際貼合度依身形與布料彈性而異；介於兩個尺碼之間時，請以選項上標示的建議體重為準。
        </p>
        {!isBra && (
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
              {labels.map((label) => (
                <th key={label} className="px-5 py-3.5 whitespace-nowrap">
                  {isBra ? label : `${label} (${sizeUnit})`}
                </th>
              ))}
              <th className="px-5 py-3.5 whitespace-nowrap">建議體重</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row, idx) => (
              <tr key={row.size || idx} className={idx % 2 === 1 ? 'bg-gray-50/40' : ''}>
                <td className="px-5 py-4 font-bold text-brand whitespace-nowrap">{row.size}</td>
                {[row.waist, row.hips, row.crotch].map((value, colIdx) => (
                  <td key={colIdx} className="px-5 py-4 whitespace-nowrap">
                    {isBra ? strip(value || '-') : formatSizeValue(value, sizeUnit)}
                  </td>
                ))}
                <td className="px-5 py-4 text-xs text-gray-600 font-medium whitespace-nowrap">{row.weight}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
