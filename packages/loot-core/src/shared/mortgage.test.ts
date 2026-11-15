import { describe, expect, it } from 'vitest';

import {
  buildSchedule,
  cpiForMonth,
  createDefaultMix,
  effectiveAnnualRate,
  monthlyPayment,
  parseSavedMixes,
  sanitizeMix,
  serializeSavedMixes,
  summarizeMix,
  validateMix,
} from './mortgage';
import type { MortgageMix, MortgageTrack, SavedMortgageMix } from './mortgage';

function track(overrides: Partial<MortgageTrack> = {}): MortgageTrack {
  return {
    id: 1,
    name: 'Track',
    principal: 100000,
    annualRate: 6,
    years: 20,
    linkage: 'fixed',
    rateChanges: [],
    ...overrides,
  };
}

function mix(overrides: Partial<MortgageMix> = {}): MortgageMix {
  return {
    prime: 6,
    primeChanges: [],
    cpi: { defaultAnnualPercent: 0, overrides: [], monthlyPercent: [] },
    tracks: [],
    ...overrides,
  };
}

describe('Spitzer payment', () => {
  it('matches the well-known value for 100,000 at 6% over 20 years', () => {
    expect(monthlyPayment(100000, 0.06 / 12, 240)).toBeCloseTo(716.43, 2);
  });

  it('keeps the payment constant for a fixed track', () => {
    const { rows, monthly } = buildSchedule(track(), mix());
    expect(monthly).toBeCloseTo(716.43, 2);
    for (const row of rows) expect(row.payment).toBeCloseTo(monthly, 6);
  });

  it('splits every payment into interest and principal', () => {
    const { rows } = buildSchedule(track(), mix());
    const first = rows[0];
    expect(first.interest).toBeCloseTo(500, 6); // 100,000 * 0.5%
    expect(first.principal + first.interest).toBeCloseTo(first.payment, 9);
  });

  it('pays back exactly the principal plus the interest', () => {
    const schedule = buildSchedule(track(), mix());
    expect(schedule.totalPaid).toBeCloseTo(100000 + schedule.totalInterest, 4);
  });
});

describe('zero interest', () => {
  it('divides the principal equally', () => {
    const schedule = buildSchedule(
      track({ principal: 120000, annualRate: 0, years: 10 }),
      mix(),
    );
    expect(schedule.months).toBe(120);
    expect(schedule.monthly).toBe(1000);
    expect(schedule.totalInterest).toBe(0);
    expect(schedule.totalPaid).toBeCloseTo(120000, 6);
  });

  it('handles a zero-rate payment helper', () => {
    expect(monthlyPayment(1200, 0, 12)).toBe(100);
  });
});

describe('final balance', () => {
  it.each([
    ['fixed', track()],
    ['short', track({ years: 1 })],
    ['zero rate', track({ annualRate: 0 })],
    ['prime', track({ linkage: 'prime', annualRate: -0.5 })],
    ['cpi', track({ linkage: 'cpi', annualRate: 3 })],
  ])('ends at zero for a %s track', (_name, t) => {
    const m = mix({
      cpi: { defaultAnnualPercent: 3, overrides: [], monthlyPercent: [] },
    });
    const schedule = buildSchedule(t, m);
    expect(schedule.finalBalance).toBe(0);
    expect(schedule.rows[schedule.rows.length - 1].balance).toBe(0);
  });

  it('returns an empty schedule for an invalid track', () => {
    expect(buildSchedule(track({ principal: 0 }), mix()).rows).toEqual([]);
    expect(buildSchedule(track({ years: 0 }), mix()).rows).toEqual([]);
  });
});

describe('rate changes', () => {
  it('prime tracks follow the prime plus the margin', () => {
    const t = track({ linkage: 'prime', annualRate: -0.5 });
    expect(effectiveAnnualRate(t, 1, mix({ prime: 6 }))).toBe(5.5);
  });

  it('re-prices the payment when the prime changes', () => {
    const t = track({ linkage: 'prime', annualRate: 0, years: 20 });
    const m = mix({
      prime: 6,
      primeChanges: [{ fromMonth: 13, annualRate: 4 }],
    });
    const schedule = buildSchedule(t, m);
    const balanceAfter12 = schedule.rows[11].balance;

    expect(schedule.rows[11].rate).toBe(6);
    expect(schedule.rows[12].rate).toBe(4);
    // payment after the change = new Spitzer payment on the remaining loan
    expect(schedule.rows[12].payment).toBeCloseTo(
      monthlyPayment(balanceAfter12, 0.04 / 12, 240 - 12),
      6,
    );
    expect(schedule.rows[12].payment).toBeLessThan(schedule.rows[11].payment);
    expect(schedule.finalBalance).toBe(0);
  });

  it('does not touch fixed tracks when the prime changes', () => {
    const m = mix({ primeChanges: [{ fromMonth: 2, annualRate: 1 }] });
    expect(effectiveAnnualRate(track(), 5, m)).toBe(6);
  });

  it('supports a track-level rate change', () => {
    const t = track({ rateChanges: [{ fromMonth: 61, annualRate: 7.5 }] });
    const schedule = buildSchedule(t, mix());
    expect(schedule.rows[59].rate).toBe(6);
    expect(schedule.rows[60].rate).toBe(7.5);
    expect(schedule.rows[60].payment).toBeGreaterThan(
      schedule.rows[59].payment,
    );
    expect(schedule.finalBalance).toBe(0);
  });
});

describe('CPI indexation', () => {
  const cpi3 = { defaultAnnualPercent: 3, overrides: [], monthlyPercent: [] };

  it('is equal to a fixed track when the index does not move', () => {
    const linked = buildSchedule(track({ linkage: 'cpi' }), mix());
    const fixed = buildSchedule(track(), mix());
    expect(linked.monthly).toBeCloseTo(fixed.monthly, 6);
    expect(linked.totalIndexation).toBeCloseTo(0, 9);
    expect(linked.totalPaid).toBeCloseTo(fixed.totalPaid, 4);
  });

  it('revalues the principal every month', () => {
    const schedule = buildSchedule(
      track({ linkage: 'cpi', annualRate: 3 }),
      mix({ cpi: cpi3 }),
    );
    const monthlyCpi = cpiForMonth(1, cpi3);
    expect(schedule.rows[0].indexation).toBeCloseTo(100000 * monthlyCpi, 6);
    expect(schedule.totalIndexation).toBeGreaterThan(0);
  });

  it('costs more than the same loan without linkage when CPI is positive', () => {
    const linked = buildSchedule(
      track({ linkage: 'cpi', annualRate: 3 }),
      mix({ cpi: cpi3 }),
    );
    const fixed = buildSchedule(track({ annualRate: 3 }), mix({ cpi: cpi3 }));
    expect(linked.totalPaid).toBeGreaterThan(fixed.totalPaid);
    expect(linked.finalBalance).toBe(0);
  });

  it('follows an explicit monthly index table over the assumptions', () => {
    const cpi = {
      defaultAnnualPercent: 3,
      overrides: [],
      monthlyPercent: [1, 0],
    };
    expect(cpiForMonth(1, cpi)).toBeCloseTo(0.01, 12);
    expect(cpiForMonth(2, cpi)).toBe(0);
    // month 3 falls back to the default assumption
    expect(cpiForMonth(3, cpi)).toBeCloseTo(Math.pow(1.03, 1 / 12) - 1, 12);

    const schedule = buildSchedule(
      track({ linkage: 'cpi', annualRate: 0, years: 10 }),
      mix({ cpi }),
    );
    expect(schedule.rows[0].indexation).toBeCloseTo(1000, 6);
    expect(schedule.rows[1].indexation).toBe(0);
  });

  it('applies step assumptions from the given month', () => {
    const cpi = {
      defaultAnnualPercent: 2,
      overrides: [{ fromMonth: 13, annualPercent: 5 }],
      monthlyPercent: [],
    };
    expect(cpiForMonth(12, cpi)).toBeCloseTo(Math.pow(1.02, 1 / 12) - 1, 12);
    expect(cpiForMonth(13, cpi)).toBeCloseTo(Math.pow(1.05, 1 / 12) - 1, 12);
  });

  it('never indexes prime or fixed tracks', () => {
    const m = mix({ cpi: cpi3 });
    expect(buildSchedule(track({ linkage: 'prime' }), m).totalIndexation).toBe(
      0,
    );
    expect(buildSchedule(track(), m).totalIndexation).toBe(0);
  });
});

describe('summarizeMix', () => {
  it('adds up the tracks', () => {
    const m = mix({
      tracks: [track({ id: 1 }), track({ id: 2, principal: 50000, years: 10 })],
    });
    const summary = summarizeMix(m);
    expect(summary.totalPrincipal).toBe(150000);
    expect(summary.firstMonthlyPayment).toBeCloseTo(
      summary.schedules[0].monthly + summary.schedules[1].monthly,
      9,
    );
    expect(summary.totalPaid).toBeCloseTo(150000 + summary.totalInterest, 3);
    expect(summary.peakMonthlyPayment).toBeGreaterThanOrEqual(
      summary.firstMonthlyPayment - 1e-9,
    );
  });

  it('discounts the real cost by inflation', () => {
    const m = mix({
      cpi: { defaultAnnualPercent: 3, overrides: [], monthlyPercent: [] },
      tracks: [track()],
    });
    const summary = summarizeMix(m);
    expect(summary.realCost).toBeLessThan(summary.totalPaid);
    const noInflation = summarizeMix({
      ...m,
      cpi: { defaultAnnualPercent: 0, overrides: [], monthlyPercent: [] },
    });
    expect(noInflation.realCost).toBeCloseTo(noInflation.totalPaid, 4);
  });

  it('handles an empty mix', () => {
    const summary = summarizeMix(mix());
    expect(summary.firstMonthlyPayment).toBe(0);
    expect(summary.realCost).toBe(0);
  });
});

describe('validation', () => {
  it('accepts the default mix', () => {
    expect(validateMix(createDefaultMix())).toEqual([]);
  });

  it('reports an empty mix and bad track fields', () => {
    expect(validateMix(mix())).toEqual([
      { trackId: null, field: 'tracks', code: 'noTracks' },
    ]);
    const issues = validateMix(
      mix({ tracks: [track({ name: ' ', principal: 0, years: 50 })] }),
    );
    expect(issues.map(i => `${i.field}:${i.code}`)).toEqual([
      'name:required',
      'principal:required',
      'years:tooLong',
    ]);
  });

  it('rejects a negative effective rate', () => {
    const issues = validateMix(
      mix({ tracks: [track({ linkage: 'prime', annualRate: -7 })] }),
    );
    expect(issues).toContainEqual({
      trackId: 1,
      field: 'rate',
      code: 'tooLow',
    });
  });
});

describe('saving and loading mixes', () => {
  const saved: SavedMortgageMix[] = [
    {
      id: 'a',
      name: 'Plan A',
      savedAt: '2026-11-15T10:00:00.000Z',
      mix: createDefaultMix(),
    },
  ];

  it('round-trips through JSON', () => {
    expect(parseSavedMixes(serializeSavedMixes(saved))).toEqual(saved);
  });

  it('round-trips rate changes and the CPI table', () => {
    const m = createDefaultMix();
    m.primeChanges = [{ fromMonth: 6, annualRate: 5 }];
    m.cpi = {
      defaultAnnualPercent: 2.5,
      overrides: [{ fromMonth: 25, annualPercent: 4 }],
      monthlyPercent: [0.1, 0.2],
    };
    m.tracks[0].rateChanges = [{ fromMonth: 2, annualRate: 0.2 }];
    const out = parseSavedMixes(
      serializeSavedMixes([{ id: 'b', name: 'B', savedAt: '', mix: m }]),
    );
    expect(out[0].mix).toEqual(m);
  });

  it('survives garbage input', () => {
    expect(parseSavedMixes('not json')).toEqual([]);
    expect(parseSavedMixes('{"a":1}')).toEqual([]);
    expect(parseSavedMixes(null)).toEqual([]);
    expect(
      parseSavedMixes([null, 1, { id: 'x' }, { id: '', mix: {} }]),
    ).toEqual([]);
  });

  it('drops invalid tracks but keeps valid ones', () => {
    const result = sanitizeMix({
      prime: 'x',
      tracks: [
        {
          id: 1,
          name: 'ok',
          principal: 5,
          annualRate: 1,
          years: 1,
          linkage: 'fixed',
        },
        { id: 2, linkage: 'bogus' },
        'nope',
      ],
    });
    expect(result?.prime).toBe(6);
    expect(result?.tracks).toHaveLength(1);
    expect(result?.tracks[0].rateChanges).toEqual([]);
    expect(sanitizeMix({})).toBeNull();
    expect(sanitizeMix(null)).toBeNull();
  });
});
