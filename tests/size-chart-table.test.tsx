import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import SizeChartTable from '../src/components/feature/SizeChartTable';
import { normalizeSizeChart } from '../src/domain/sizeChart';

describe('SizeChartTable', () => {
  it('renders the columns a product actually has, with units', () => {
    const chart = normalizeSizeChart({
      columns: [{ label: '腰圍（平量）', unit: 'cm' }, { label: '腿圍（平量）', unit: 'cm' }, { label: '建議體重', unit: 'kg' }],
      rows: [{ size: 'L', values: ['28', '21', '45-55'] }],
      note: '數值來自 LUCISSI 原廠尺寸圖；平量為衣物平放測量。',
    })!;
    const html = renderToString(<SizeChartTable chart={chart} />);
    expect(html).toContain('腰圍（平量） (cm)');
    expect(html).toContain('腿圍（平量） (cm)');
    expect(html).toContain('建議體重 (kg)');
    expect(html).toContain('45-55');
    expect(html).toContain('平量為衣物平放測量');
    expect(html).not.toContain('襠深');
  });

  it('hides the inch toggle when no column is in cm', () => {
    const chart = normalizeSizeChart({ columns: [{ label: '建議體重', unit: 'kg' }], rows: [{ size: 'M', values: ['40-50'] }] })!;
    expect(renderToString(<SizeChartTable chart={chart} />)).not.toContain('英吋');
  });
});
