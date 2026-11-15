const shekel = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 });

/** Whole-shekel amount, e.g. ₪5,734. */
export function formatShekel(amount: number): string {
  return '₪' + shekel.format(Math.round(amount));
}

export function formatPercent(rate: number): string {
  return rate.toFixed(2) + '%';
}

/** Month number (1-based) to a "year / month" pair for the schedule. */
export function toYearMonth(period: number): { year: number; month: number } {
  return { year: Math.ceil(period / 12), month: ((period - 1) % 12) + 1 };
}

/** Parses "0.2, 0.3 0.1" into [0.2, 0.3, 0.1]; ignores anything else. */
export function parseNumberList(text: string): number[] {
  return text
    .split(/[\s,;]+/)
    .filter(part => part !== '')
    .map(Number)
    .filter(value => Number.isFinite(value));
}
