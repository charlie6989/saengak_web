import { describe, expect, it } from 'vitest';
import { normalizeSizeChart, toInches } from './sizeChart';

describe('normalizeSizeChart', () => {
  it('reads the flexible format and pads missing values', () => {
    const chart = normalizeSizeChart({
      columns: [{ label: '腰圍', unit: 'cm' }, { label: '腿圍', unit: 'cm' }, { label: '建議體重', unit: 'kg' }],
      rows: [{ size: 'M', values: ['65-78', '45-58', '40-49'] }, { size: 'L', values: ['70-83'] }],
      note: '數值來自原廠尺寸圖',
    });
    expect(chart?.columns.map((c) => c.label)).toEqual(['腰圍', '腿圍', '建議體重']);
    expect(chart?.rows[1].values).toEqual(['70-83', '', '']);
    expect(chart?.note).toBe('數值來自原廠尺寸圖');
  });

  it('converts the legacy waist/hips/crotch rows', () => {
    const chart = normalizeSizeChart([{ size: 'M (90)', waist: '60 - 68', hips: '82 - 90', crotch: '21.5', weight: '40 ~ 50 kg' }]);
    expect(chart?.columns.map((c) => c.label)).toEqual(['腰圍', '臀圍', '襠深', '建議體重']);
    expect(chart?.rows[0]).toEqual({ size: 'M (90)', values: ['60 - 68', '82 - 90', '21.5', '40 ~ 50 kg'] });
  });

  it('labels legacy bra rows with bra columns', () => {
    const chart = normalizeSizeChart([{ size: 'M', waist: '下胸圍 70-75cm', hips: '建議罩杯 A-B', crotch: '舒適微聚攏', weight: '45-52kg' }]);
    expect(chart?.columns[0].label).toBe('下胸圍');
    expect(chart?.rows[0].values.slice(0, 2)).toEqual(['70-75cm', 'A-B']);
  });

  it('keeps values under their own column when a malformed column is skipped', () => {
    const chart = normalizeSizeChart({
      columns: [{ label: '腰圍', unit: 'cm' }, {}, { label: '建議體重', unit: 'kg' }],
      rows: [{ size: 'M', values: ['60', '', '50'] }],
    });
    expect(chart?.columns.map((c) => c.label)).toEqual(['腰圍', '建議體重']);
    expect(chart?.rows[0].values).toEqual(['60', '50']);
  });

  it('rejects empty or malformed data', () => {
    expect(normalizeSizeChart(undefined)).toBeUndefined();
    expect(normalizeSizeChart({ columns: [], rows: [] })).toBeUndefined();
    expect(normalizeSizeChart({ columns: [{ label: '腰圍' }], rows: [{ values: ['1'] }] })).toBeUndefined();
  });
});

describe('toInches', () => {
  it('converts every number in a range', () => {
    expect(toInches('60-68')).toBe('23.6-26.8');
    expect(toInches('-')).toBe('-');
  });

  it('drops embedded cm units so inch cells do not say cm', () => {
    expect(toInches('70-75cm')).toBe('27.6-29.5');
    expect(toInches('70-75 cm')).toBe('27.6-29.5');
    expect(toInches('下圍 70 公分')).toBe('下圍 27.6');
  });
});
