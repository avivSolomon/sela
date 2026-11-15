import { buildSchedule } from '@actual-app/core/shared/mortgage';
import type { MortgageMix } from '@actual-app/core/shared/mortgage';
import { describe, expect, it } from 'vitest';

import { parseNumberList, toYearMonth } from './format';
import { aggregateByYear, toDisplayRows } from './scheduleRows';

const mix: Pick<MortgageMix, 'prime' | 'primeChanges' | 'cpi'> = {
  prime: 6,
  primeChanges: [],
  cpi: { defaultAnnualPercent: 0, overrides: [], monthlyPercent: [] },
};

const schedule = buildSchedule(
  {
    id: 1,
    name: 'Fixed',
    principal: 120000,
    annualRate: 0,
    years: 3,
    linkage: 'fixed',
    rateChanges: [],
  },
  mix,
);

describe('schedule views', () => {
  it('shows the first 12 months', () => {
    const rows = toDisplayRows(schedule.rows, 'first12');
    expect(rows).toHaveLength(12);
    expect(rows[0].period).toBe(1);
  });

  it('shows every month', () => {
    expect(toDisplayRows(schedule.rows, 'monthly')).toHaveLength(36);
  });

  it('adds up each loan year', () => {
    const years = aggregateByYear(schedule.rows);
    expect(years.map(y => y.year)).toEqual([1, 2, 3]);
    expect(years[0].payment).toBeCloseTo(40000, 6);
    expect(years[0].principal).toBeCloseTo(40000, 6);
    expect(years[2].balance).toBe(0);
  });

  it('has no rate in the yearly view', () => {
    expect(toDisplayRows(schedule.rows, 'yearly')[0].rate).toBeNull();
  });
});

describe('helpers', () => {
  it('maps a month number to year and month', () => {
    expect(toYearMonth(1)).toEqual({ year: 1, month: 1 });
    expect(toYearMonth(12)).toEqual({ year: 1, month: 12 });
    expect(toYearMonth(13)).toEqual({ year: 2, month: 1 });
  });

  it('reads a list of numbers and ignores junk', () => {
    expect(parseNumberList('0.3, 0.1 -0.2;x ,')).toEqual([0.3, 0.1, -0.2]);
    expect(parseNumberList('')).toEqual([]);
  });
});
