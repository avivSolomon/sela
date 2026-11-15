import { describe, expect, it } from 'vitest';

import {
  createDefaultMix,
  debtToIncome,
  dtiBand,
  mixMonths,
  payoffMonth,
  realInterestCost,
  sanitizeMix,
  summarizeMix,
} from './mortgage';

describe('debtToIncome', () => {
  const summary = { firstMonthlyPayment: 6000 };

  it('divides the payment by the income', () => {
    expect(debtToIncome(summary, 20000)).toBeCloseTo(0.3, 10);
  });

  it('is null without a usable income', () => {
    expect(debtToIncome(summary, undefined)).toBeNull();
    expect(debtToIncome(summary, 0)).toBeNull();
    expect(debtToIncome(summary, -5)).toBeNull();
  });
});

describe('dtiBand', () => {
  it.each([
    [0.1, 'comfortable'],
    [0.3, 'comfortable'],
    [0.31, 'heavy'],
    [0.4, 'heavy'],
    [0.41, 'risky'],
    [0.9, 'risky'],
  ])('reads %s as %s', (ratio, band) => {
    expect(dtiBand(ratio)).toBe(band);
  });
});

describe('payoffMonth', () => {
  it('counts the first payment as the start month', () => {
    expect(payoffMonth('2026-11', 1)).toBe('2026-11');
    expect(payoffMonth('2026-11', 2)).toBe('2026-12');
    expect(payoffMonth('2026-11', 3)).toBe('2027-01');
  });

  it('adds whole years', () => {
    expect(payoffMonth('2026-01', 300)).toBe('2050-12');
  });

  it('rejects a bad start or an empty schedule', () => {
    expect(payoffMonth(undefined, 12)).toBeNull();
    expect(payoffMonth('2026-13', 12)).toBeNull();
    expect(payoffMonth('nov 2026', 12)).toBeNull();
    expect(payoffMonth('2026-11', 0)).toBeNull();
  });
});

describe('real interest cost and duration', () => {
  it('is the real cost minus the loan', () => {
    const summary = summarizeMix(createDefaultMix());
    expect(realInterestCost(summary)).toBeCloseTo(
      summary.realCost - summary.totalPrincipal,
      6,
    );
    expect(realInterestCost(summary)).toBeLessThan(summary.totalInterest);
  });

  it('uses the longest track for the duration', () => {
    expect(mixMonths(summarizeMix(createDefaultMix()))).toBe(300);
  });
});

describe('income and start month in saved mixes', () => {
  it('keeps valid values', () => {
    const mix = {
      ...createDefaultMix(),
      monthlyIncome: 18000,
      startMonth: '2026-12',
    };
    const out = sanitizeMix(JSON.parse(JSON.stringify(mix)));
    expect(out?.monthlyIncome).toBe(18000);
    expect(out?.startMonth).toBe('2026-12');
  });

  it('drops invalid values', () => {
    const out = sanitizeMix({
      ...createDefaultMix(),
      monthlyIncome: -3,
      startMonth: '12/2026',
    });
    expect(out).not.toHaveProperty('monthlyIncome');
    expect(out).not.toHaveProperty('startMonth');
  });
});
