import type { ScheduleRow } from '@actual-app/core/shared/mortgage';

export type YearRow = {
  year: number;
  payment: number;
  interest: number;
  principal: number;
  indexation: number;
  balance: number;
};

export type ScheduleView = 'first12' | 'yearly' | 'monthly';

export type DisplayRow = {
  key: string;
  /** Month number, or loan year for the yearly view. */
  period: number;
  rate: number | null;
  payment: number;
  interest: number;
  principal: number;
  indexation: number;
  balance: number;
};

/** Rows to show for the chosen view of a track's schedule. */
export function toDisplayRows(
  rows: ScheduleRow[],
  view: ScheduleView,
): DisplayRow[] {
  if (view === 'yearly') {
    return aggregateByYear(rows).map(row => ({
      key: `y${row.year}`,
      period: row.year,
      rate: null,
      payment: row.payment,
      interest: row.interest,
      principal: row.principal,
      indexation: row.indexation,
      balance: row.balance,
    }));
  }
  const shown = view === 'first12' ? rows.slice(0, 12) : rows;
  return shown.map(row => ({ ...row, key: `m${row.period}` }));
}

/** Sums the monthly rows by calendar-of-loan year (months 1-12 = year 1). */
export function aggregateByYear(rows: ScheduleRow[]): YearRow[] {
  const years: YearRow[] = [];
  for (const row of rows) {
    const year = Math.ceil(row.period / 12);
    let current = years[years.length - 1];
    if (!current || current.year !== year) {
      current = {
        year,
        payment: 0,
        interest: 0,
        principal: 0,
        indexation: 0,
        balance: 0,
      };
      years.push(current);
    }
    current.payment += row.payment;
    current.interest += row.interest;
    current.principal += row.principal;
    current.indexation += row.indexation;
    current.balance = row.balance;
  }
  return years;
}
