/**
 * 商品尺寸表（Shopify metafield custom.size_chart，JSON）。
 *
 * 各款原廠尺寸圖的量法不同（身體尺寸範圍、衣物平量、腿圍、中長、側腰寬、罩杯對照），
 * 因此欄位由資料決定：
 *   { "columns": [{ "label": "腰圍", "unit": "cm" }, ...],
 *     "rows": [{ "size": "M", "values": ["58-64", ...] }, ...],
 *     "note": "..." }
 * 舊格式（[{ size, waist, hips, crotch, weight }]）仍可讀取，轉成相同結構。
 */

export interface SizeChartColumn {
  label: string;
  /** 單位；cm 欄位可切換英吋顯示 */
  unit?: string;
}

export interface SizeChartRow {
  size: string;
  values: string[];
}

export interface SizeChart {
  columns: SizeChartColumn[];
  rows: SizeChartRow[];
  note?: string;
}

const text = (value: unknown) => (typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '');

function fromLegacyRows(raw: unknown[]): SizeChart | undefined {
  const rows = raw.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object');
  if (rows.length === 0) return undefined;

  // 舊內衣尺碼表把下胸圍、罩杯與支撐感存在 waist／hips／crotch 欄位
  const isBra = rows.some((row) => text(row.waist).includes('下胸圍') || text(row.hips).includes('罩杯'));
  const strip = (value: string) => value.replace(/^(下胸圍|建議罩杯)\s*/, '');
  const columns: SizeChartColumn[] = isBra
    ? [{ label: '下胸圍' }, { label: '建議罩杯' }, { label: '支撐感' }, { label: '建議體重' }]
    : [{ label: '腰圍', unit: 'cm' }, { label: '臀圍', unit: 'cm' }, { label: '襠深', unit: 'cm' }, { label: '建議體重' }];

  return {
    columns,
    rows: rows.map((row) => ({
      size: text(row.size),
      values: [row.waist, row.hips, row.crotch, row.weight].map((value, idx) =>
        isBra && idx < 2 ? strip(text(value)) : text(value),
      ),
    })),
  };
}

export function normalizeSizeChart(raw: unknown): SizeChart | undefined {
  if (Array.isArray(raw)) return fromLegacyRows(raw);
  if (!raw || typeof raw !== 'object') return undefined;

  const value = raw as Record<string, unknown>;
  if (!Array.isArray(value.columns) || !Array.isArray(value.rows)) return undefined;

  const columns = value.columns
    .map((column): SizeChartColumn | null => {
      if (!column || typeof column !== 'object') return null;
      const label = text((column as Record<string, unknown>).label);
      const unit = text((column as Record<string, unknown>).unit);
      return label ? { label, ...(unit ? { unit } : {}) } : null;
    })
    .filter((column): column is SizeChartColumn => column !== null);
  if (columns.length === 0) return undefined;

  const rows = value.rows
    .map((row): SizeChartRow | null => {
      if (!row || typeof row !== 'object') return null;
      const record = row as Record<string, unknown>;
      const size = text(record.size);
      const values = Array.isArray(record.values) ? record.values.map(text) : [];
      if (!size) return null;
      return { size, values: columns.map((_, idx) => values[idx] ?? '') };
    })
    .filter((row): row is SizeChartRow => row !== null);
  if (rows.length === 0) return undefined;

  const note = text(value.note);
  return { columns, rows, ...(note ? { note } : {}) };
}

/** 將 cm 數值換算為英吋（保留範圍符號與其他文字） */
export function toInches(value: string): string {
  if (!value || value === '-') return value || '-';
  return value.replace(/\d+(?:\.\d+)?/g, (match) => (parseFloat(match) * 0.3937).toFixed(1));
}
