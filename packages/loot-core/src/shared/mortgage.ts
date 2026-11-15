/**
 * Sela - Israeli mortgage engine.
 *
 * Pure, framework-free calculations for a mortgage "mix" made of several
 * tracks. Every track is amortized with the Spitzer (constant payment) method.
 * A track has exactly one linkage type:
 *
 *  - `prime`: floating rate = prime + margin. A prime change re-prices all
 *    prime tracks from the given month.
 *  - `cpi`:   the outstanding principal is linked to the consumer price index.
 *    Each month the balance is revalued by that month's CPI change before
 *    interest is charged.
 *  - `fixed`: a fixed, unlinked rate.
 *
 * Whenever the balance or the rate changes (indexation, rate change) the
 * payment is recomputed for the remaining months, so the loan always ends at
 * a zero balance.
 */

export type LinkageType = 'prime' | 'cpi' | 'fixed';

/** A new rate that starts at `fromMonth` (1-based) and stays until changed. */
export type RateChange = { fromMonth: number; annualRate: number };

export type CpiAssumption = {
  /** Annual CPI (%) assumed for every month not covered below. */
  defaultAnnualPercent: number;
  /** Step assumptions: from this month on, use this annual CPI (%). */
  overrides: { fromMonth: number; annualPercent: number }[];
  /**
   * Explicit index table. `monthlyPercent[m - 1]` is the CPI change (%) of
   * month `m`. Entries here win over the assumptions above.
   */
  monthlyPercent: number[];
};

export type MortgageTrack = {
  id: number;
  name: string;
  principal: number;
  /** Annual rate (%). For prime tracks this is the margin over the prime. */
  annualRate: number;
  years: number;
  linkage: LinkageType;
  /** Re-pricing of this track's own rate (same meaning as `annualRate`). */
  rateChanges: RateChange[];
};

export type MortgageMix = {
  /** Current prime rate (%). */
  prime: number;
  /** Prime changes (`annualRate` is the new prime). */
  primeChanges: RateChange[];
  cpi: CpiAssumption;
  tracks: MortgageTrack[];
  /** Household net income per month (₪), for the debt-to-income ratio. */
  monthlyIncome?: number;
  /** Month the first payment is made, "YYYY-MM", for the payoff date. */
  startMonth?: string;
};

export type ScheduleRow = {
  period: number;
  /** Effective annual rate (%) used this month. */
  rate: number;
  /** Principal added this month by CPI linkage (0 for non-linked tracks). */
  indexation: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
};

export type TrackSchedule = {
  months: number;
  rows: ScheduleRow[];
  /** First month's payment. */
  monthly: number;
  totalInterest: number;
  totalIndexation: number;
  totalPaid: number;
  finalBalance: number;
};

export type MixSummary = {
  schedules: TrackSchedule[];
  totalPrincipal: number;
  /** Sum of the first month's payments over all tracks. */
  firstMonthlyPayment: number;
  peakMonthlyPayment: number;
  totalInterest: number;
  totalIndexation: number;
  totalPaid: number;
  /** Present value of all payments, deflated by the CPI path. */
  realCost: number;
};

export type ValidationIssue = {
  trackId: number | null;
  field: 'principal' | 'years' | 'rate' | 'name' | 'cpi' | 'prime' | 'tracks';
  code: 'required' | 'negative' | 'tooLong' | 'tooLow' | 'tooHigh' | 'noTracks';
};

export const MAX_YEARS = 40;

// ---------------------------------------------------------------------------
// Core maths
// ---------------------------------------------------------------------------

/** Constant payment A = P·i / (1 − (1+i)^−n); P/n when the rate is zero. */
export function monthlyPayment(
  principal: number,
  monthlyRate: number,
  months: number,
): number {
  if (months <= 0 || principal <= 0) return 0;
  if (monthlyRate === 0) return principal / months;
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
}

function byMonth<T extends { fromMonth: number }>(changes: T[]): T[] {
  return [...changes].sort((a, b) => a.fromMonth - b.fromMonth);
}

function latestAt<T extends { fromMonth: number }>(
  changes: T[],
  month: number,
): T | undefined {
  let found: T | undefined;
  for (const change of byMonth(changes)) {
    if (change.fromMonth <= month) found = change;
  }
  return found;
}

/** Annual percent -> equivalent monthly fraction (compounded). */
export function monthlyFromAnnualPercent(annualPercent: number): number {
  return Math.pow(1 + annualPercent / 100, 1 / 12) - 1;
}

/** CPI change of the given month (1-based) as a fraction, e.g. 0.002. */
export function cpiForMonth(month: number, cpi: CpiAssumption): number {
  const explicit = cpi.monthlyPercent[month - 1];
  if (typeof explicit === 'number' && Number.isFinite(explicit)) {
    return explicit / 100;
  }
  const step = latestAt(cpi.overrides, month);
  return monthlyFromAnnualPercent(
    step ? step.annualPercent : cpi.defaultAnnualPercent,
  );
}

/** Effective annual rate (%) of a track in a given month (1-based). */
export function effectiveAnnualRate(
  track: MortgageTrack,
  month: number,
  mix: Pick<MortgageMix, 'prime' | 'primeChanges'>,
): number {
  const own = latestAt(track.rateChanges, month);
  const base = own ? own.annualRate : track.annualRate;
  if (track.linkage !== 'prime') return base;
  const primeChange = latestAt(mix.primeChanges, month);
  return (primeChange ? primeChange.annualRate : mix.prime) + base;
}

// ---------------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------------

export function buildSchedule(
  track: MortgageTrack,
  mix: Pick<MortgageMix, 'prime' | 'primeChanges' | 'cpi'>,
): TrackSchedule {
  const months = Math.max(0, Math.round(track.years * 12));
  const rows: ScheduleRow[] = [];
  let balance = Math.max(0, track.principal);
  let totalInterest = 0;
  let totalIndexation = 0;
  let totalPaid = 0;

  for (let period = 1; period <= months && balance > 0; period++) {
    let indexation = 0;
    if (track.linkage === 'cpi') {
      indexation = balance * cpiForMonth(period, mix.cpi);
      balance += indexation;
    }
    const rate = effectiveAnnualRate(track, period, mix);
    const monthlyRate = rate / 100 / 12;
    const interest = balance * monthlyRate;
    const payment = monthlyPayment(balance, monthlyRate, months - period + 1);
    const principalPaid = payment - interest;
    balance = Math.max(0, balance - principalPaid);
    if (balance < 1e-6) balance = 0;

    totalInterest += interest;
    totalIndexation += indexation;
    totalPaid += payment;
    rows.push({
      period,
      rate,
      indexation,
      payment,
      interest,
      principal: principalPaid,
      balance,
    });
  }

  return {
    months,
    rows,
    monthly: rows.length > 0 ? rows[0].payment : 0,
    totalInterest,
    totalIndexation,
    totalPaid,
    finalBalance: balance,
  };
}

export function summarizeMix(mix: MortgageMix): MixSummary {
  const schedules = mix.tracks.map(track => buildSchedule(track, mix));
  const longest = schedules.reduce((max, s) => Math.max(max, s.rows.length), 0);

  let peakMonthlyPayment = 0;
  let realCost = 0;
  let deflator = 1;
  for (let month = 1; month <= longest; month++) {
    deflator *= 1 + cpiForMonth(month, mix.cpi);
    let monthTotal = 0;
    for (const schedule of schedules) {
      const row = schedule.rows[month - 1];
      if (row) monthTotal += row.payment;
    }
    peakMonthlyPayment = Math.max(peakMonthlyPayment, monthTotal);
    realCost += monthTotal / deflator;
  }

  return {
    schedules,
    totalPrincipal: mix.tracks.reduce(
      (s, t) => s + Math.max(0, t.principal),
      0,
    ),
    firstMonthlyPayment: schedules.reduce((s, x) => s + x.monthly, 0),
    peakMonthlyPayment,
    totalInterest: schedules.reduce((s, x) => s + x.totalInterest, 0),
    totalIndexation: schedules.reduce((s, x) => s + x.totalIndexation, 0),
    totalPaid: schedules.reduce((s, x) => s + x.totalPaid, 0),
    realCost,
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateMix(mix: MortgageMix): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (mix.tracks.length === 0) {
    issues.push({ trackId: null, field: 'tracks', code: 'noTracks' });
  }
  if (mix.prime < 0) {
    issues.push({ trackId: null, field: 'prime', code: 'negative' });
  }
  if (mix.cpi.defaultAnnualPercent < -20 || mix.cpi.defaultAnnualPercent > 50) {
    issues.push({ trackId: null, field: 'cpi', code: 'tooHigh' });
  }
  for (const track of mix.tracks) {
    if (track.name.trim() === '') {
      issues.push({ trackId: track.id, field: 'name', code: 'required' });
    }
    if (!(track.principal > 0)) {
      issues.push({ trackId: track.id, field: 'principal', code: 'required' });
    }
    if (!(track.years > 0)) {
      issues.push({ trackId: track.id, field: 'years', code: 'required' });
    } else if (track.years > MAX_YEARS) {
      issues.push({ trackId: track.id, field: 'years', code: 'tooLong' });
    }
    // The effective rate must never be negative (a prime margin may be).
    const months = [
      1,
      ...track.rateChanges.map(c => c.fromMonth),
      ...mix.primeChanges.map(c => c.fromMonth),
    ];
    const lowest = Math.min(
      ...months.map(m => effectiveAnnualRate(track, m, mix)),
    );
    if (lowest < 0) {
      issues.push({ trackId: track.id, field: 'rate', code: 'tooLow' });
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Defaults, sanitizing and (de)serialization for saved mixes
// ---------------------------------------------------------------------------

export type DefaultTrackNames = { prime: string; cpi: string; fixed: string };

export function createDefaultMix(
  names: DefaultTrackNames = {
    prime: 'Prime',
    cpi: 'CPI-linked fixed',
    fixed: 'Unlinked fixed',
  },
): MortgageMix {
  return {
    prime: 6,
    primeChanges: [],
    cpi: { defaultAnnualPercent: 3, overrides: [], monthlyPercent: [] },
    tracks: [
      {
        id: 1,
        name: names.prime,
        principal: 400000,
        annualRate: -0.5,
        years: 25,
        linkage: 'prime',
        rateChanges: [],
      },
      {
        id: 2,
        name: names.cpi,
        principal: 350000,
        annualRate: 3.2,
        years: 25,
        linkage: 'cpi',
        rateChanges: [],
      },
      {
        id: 3,
        name: names.fixed,
        principal: 250000,
        annualRate: 4.5,
        years: 20,
        linkage: 'fixed',
        rateChanges: [],
      },
    ],
  };
}

export type SavedMortgageMix = {
  id: string;
  name: string;
  /** ISO timestamp of the last save. */
  savedAt: string;
  mix: MortgageMix;
};

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function sanitizeChanges(value: unknown): RateChange[] {
  if (!Array.isArray(value)) return [];
  const out: RateChange[] = [];
  for (const item of value) {
    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>;
      const fromMonth = Math.round(num(record.fromMonth, NaN));
      const annualRate = num(record.annualRate, NaN);
      if (
        Number.isFinite(fromMonth) &&
        fromMonth >= 1 &&
        Number.isFinite(annualRate)
      ) {
        out.push({ fromMonth, annualRate });
      }
    }
  }
  return byMonth(out);
}

const START_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Returns a well-formed mix, or null if the value is not a mortgage mix. */
export function sanitizeMix(value: unknown): MortgageMix | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.tracks)) return null;

  const tracks: MortgageTrack[] = [];
  for (const raw of record.tracks) {
    if (!raw || typeof raw !== 'object') continue;
    const t = raw as Record<string, unknown>;
    const linkage = t.linkage;
    if (linkage !== 'prime' && linkage !== 'cpi' && linkage !== 'fixed') {
      continue;
    }
    tracks.push({
      id: Math.round(num(t.id, tracks.length + 1)),
      name: typeof t.name === 'string' ? t.name : '',
      principal: Math.max(0, num(t.principal, 0)),
      annualRate: num(t.annualRate, 0),
      years: Math.max(0, num(t.years, 0)),
      linkage,
      rateChanges: sanitizeChanges(t.rateChanges),
    });
  }

  const rawCpi = (
    record.cpi && typeof record.cpi === 'object' ? record.cpi : {}
  ) as Record<string, unknown>;
  const overrides: CpiAssumption['overrides'] = [];
  if (Array.isArray(rawCpi.overrides)) {
    for (const item of rawCpi.overrides) {
      if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>;
        const fromMonth = Math.round(num(o.fromMonth, NaN));
        const annualPercent = num(o.annualPercent, NaN);
        if (
          Number.isFinite(fromMonth) &&
          fromMonth >= 1 &&
          Number.isFinite(annualPercent)
        ) {
          overrides.push({ fromMonth, annualPercent });
        }
      }
    }
  }
  const monthlyPercent = Array.isArray(rawCpi.monthlyPercent)
    ? rawCpi.monthlyPercent.map(v => num(v, NaN))
    : [];

  const income = num(record.monthlyIncome, 0);
  const startMonth =
    typeof record.startMonth === 'string' && START_MONTH.test(record.startMonth)
      ? record.startMonth
      : undefined;

  return {
    ...(income > 0 ? { monthlyIncome: income } : {}),
    ...(startMonth ? { startMonth } : {}),
    prime: num(record.prime, 6),
    primeChanges: sanitizeChanges(record.primeChanges),
    cpi: {
      defaultAnnualPercent: num(rawCpi.defaultAnnualPercent, 3),
      overrides: byMonth(overrides),
      monthlyPercent,
    },
    tracks,
  };
}

export function parseSavedMixes(raw: unknown): SavedMortgageMix[] {
  let data: unknown = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(data)) return [];

  const out: SavedMortgageMix[] = [];
  for (const item of data) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const mix = sanitizeMix(r.mix);
    if (!mix || typeof r.id !== 'string' || r.id === '') continue;
    out.push({
      id: r.id,
      name: typeof r.name === 'string' ? r.name : '',
      savedAt: typeof r.savedAt === 'string' ? r.savedAt : '',
      mix,
    });
  }
  return out;
}

export function serializeSavedMixes(mixes: SavedMortgageMix[]): string {
  return JSON.stringify(mixes);
}

// ---------------------------------------------------------------------------
// CPI table import
// ---------------------------------------------------------------------------

/**
 * Reads monthly CPI changes (%) from the text of a CSV / pasted table.
 *
 * Every line holds one month, in order. The value is the last number on the
 * line, so "0.3", "2024-01,0.3", "2024-01;0,3" and "ינואר 2024<TAB>-0.1" all
 * work. A comma is read as a decimal separator only when the line has no
 * other separator. Lines without a number (headers, blanks) are skipped.
 */
export function parseCpiTable(text: string): number[] {
  const values: number[] = [];
  for (const rawLine of text.replace(/^﻿/, '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '') continue;

    let cells = line.split(/[;\t]/);
    if (cells.length === 1) {
      // "2024-01,0.3" -> comma separates the columns; "0,3" -> decimal comma
      const commaCells = line.split(',');
      // (a label such as a date with a 4-digit year, then a number)
      cells =
        commaCells.length === 2 &&
        /^\s*-?\d+(\.\d+)?\s*%?\s*$/.test(commaCells[1]) &&
        /\d{4}/.test(commaCells[0])
          ? commaCells
          : [line];
    }
    const last = cells[cells.length - 1]
      .trim()
      .replace(/%$/, '')
      .replace(',', '.');
    const value = Number(last);
    if (last !== '' && Number.isFinite(value)) values.push(value);
  }
  return values;
}

// ---------------------------------------------------------------------------
// Comparing mixes
// ---------------------------------------------------------------------------

export type ComparisonKey =
  | 'firstMonthlyPayment'
  | 'peakMonthlyPayment'
  | 'totalInterest'
  | 'totalIndexation'
  | 'totalPaid'
  | 'realCost';

export type ComparisonRow = {
  key: ComparisonKey;
  a: number;
  b: number;
  /** b - a: negative means the second mix is cheaper. */
  difference: number;
};

const COMPARISON_KEYS: ComparisonKey[] = [
  'firstMonthlyPayment',
  'peakMonthlyPayment',
  'totalInterest',
  'totalIndexation',
  'totalPaid',
  'realCost',
];

export function compareSummaries(
  a: MixSummary,
  b: MixSummary,
): ComparisonRow[] {
  return COMPARISON_KEYS.map(key => ({
    key,
    a: a[key],
    b: b[key],
    difference: b[key] - a[key],
  }));
}

// ---------------------------------------------------------------------------
// Dashboard: debt-to-income, real interest cost, payoff date
// ---------------------------------------------------------------------------

/** First monthly payment divided by the monthly income; null without income. */
export function debtToIncome(
  summary: Pick<MixSummary, 'firstMonthlyPayment'>,
  monthlyIncome: number | undefined,
): number | null {
  if (!monthlyIncome || monthlyIncome <= 0) return null;
  return summary.firstMonthlyPayment / monthlyIncome;
}

export type DtiBand = 'comfortable' | 'heavy' | 'risky';

/**
 * A rule-of-thumb reading of the ratio (an indication, not advice): up to
 * 30% comfortable, up to 40% heavy, above that risky.
 */
export function dtiBand(ratio: number): DtiBand {
  if (ratio <= 0.3) return 'comfortable';
  if (ratio <= 0.4) return 'heavy';
  return 'risky';
}

/** What borrowing really costs in today's money: real payments minus the loan. */
export function realInterestCost(
  summary: Pick<MixSummary, 'realCost' | 'totalPrincipal'>,
): number {
  return summary.realCost - summary.totalPrincipal;
}

/**
 * Month of the last payment as "YYYY-MM" (the first payment is in
 * `startMonth`), or null for an invalid start or an empty schedule.
 */
export function payoffMonth(
  startMonth: string | undefined,
  months: number,
): string | null {
  if (!startMonth || !START_MONTH.test(startMonth) || months <= 0) return null;
  const [year, month] = startMonth.split('-').map(Number);
  const index = year * 12 + (month - 1) + (months - 1);
  const endYear = Math.floor(index / 12);
  const endMonth = (index % 12) + 1;
  return `${endYear}-${String(endMonth).padStart(2, '0')}`;
}

/** Number of months until the whole mix is paid off. */
export function mixMonths(summary: Pick<MixSummary, 'schedules'>): number {
  return summary.schedules.reduce((max, s) => Math.max(max, s.rows.length), 0);
}

// ---------------------------------------------------------------------------
// Series and export
// ---------------------------------------------------------------------------

export type MonthlyPoint = {
  month: number;
  /** All tracks together. */
  payment: number;
  /** Outstanding principal after the payment, all tracks together. */
  balance: number;
};

/** The whole mix, month by month (for charts and exports). */
export function monthlySeries(summary: MixSummary): MonthlyPoint[] {
  const longest = summary.schedules.reduce(
    (max, s) => Math.max(max, s.rows.length),
    0,
  );
  const points: MonthlyPoint[] = [];
  for (let month = 1; month <= longest; month++) {
    let payment = 0;
    let balance = 0;
    for (const schedule of summary.schedules) {
      const row = schedule.rows[month - 1];
      if (row) {
        payment += row.payment;
        balance += row.balance;
      }
    }
    points.push({ month, payment, balance });
  }
  return points;
}

export type ScheduleCsvLabels = {
  track: string;
  month: string;
  rate: string;
  indexation: string;
  payment: string;
  interest: string;
  principal: string;
  balance: string;
};

function csvCell(value: string | number): string {
  const text =
    typeof value === 'number' ? String(Math.round(value * 100) / 100) : value;
  // Neutralise spreadsheet formulas in names typed by the user
  const safe =
    /^[=+\-@\t\r]/.test(text) && typeof value === 'string' ? "'" + text : text;
  return /[",\n\r]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
}

/** Every track's amortization schedule as CSV text (without a BOM). */
export function scheduleToCsv(
  mix: MortgageMix,
  summary: MixSummary,
  labels: ScheduleCsvLabels,
): string {
  const lines = [
    [
      labels.track,
      labels.month,
      labels.rate,
      labels.indexation,
      labels.payment,
      labels.interest,
      labels.principal,
      labels.balance,
    ]
      .map(csvCell)
      .join(','),
  ];
  mix.tracks.forEach((track, index) => {
    for (const row of summary.schedules[index]?.rows ?? []) {
      lines.push(
        [
          track.name,
          row.period,
          row.rate,
          row.indexation,
          row.payment,
          row.interest,
          row.principal,
          row.balance,
        ]
          .map(csvCell)
          .join(','),
      );
    }
  });
  return lines.join('\r\n') + '\r\n';
}
