import { describe, expect, it } from 'vitest';

import {
  compareSummaries,
  createDefaultMix,
  monthlySeries,
  parseCpiTable,
  scheduleToCsv,
  summarizeMix,
} from './mortgage';

describe('parseCpiTable', () => {
  it('reads one value per line', () => {
    expect(parseCpiTable('0.3\n0.1\n-0.2')).toEqual([0.3, 0.1, -0.2]);
  });

  it('takes the last number of a dated line', () => {
    expect(parseCpiTable('2024-01,0.3\n2024-02;0,1\n2024-03\t-0.2')).toEqual([
      0.3, 0.1, -0.2,
    ]);
  });

  it('reads a decimal comma and percent signs', () => {
    expect(parseCpiTable('0,3\n0.4%')).toEqual([0.3, 0.4]);
  });

  it('skips headers, blank lines and a BOM', () => {
    expect(parseCpiTable('﻿month,cpi\r\n\r\n2024-01,0.5\r\n')).toEqual([0.5]);
  });

  it('returns nothing for text without numbers', () => {
    expect(parseCpiTable('hello\nworld')).toEqual([]);
    expect(parseCpiTable('')).toEqual([]);
  });
});

describe('compareSummaries', () => {
  const base = createDefaultMix();
  const cheaper = createDefaultMix();
  cheaper.prime = 4;

  it('reports the difference of every measure', () => {
    const rows = compareSummaries(summarizeMix(base), summarizeMix(cheaper));
    expect(rows.map(r => r.key)).toEqual([
      'firstMonthlyPayment',
      'peakMonthlyPayment',
      'totalInterest',
      'totalIndexation',
      'totalPaid',
      'realCost',
    ]);
    const interest = rows.find(r => r.key === 'totalInterest');
    expect(interest?.difference).toBeLessThan(0);
    expect(interest?.difference).toBeCloseTo(
      (interest?.b ?? 0) - (interest?.a ?? 0),
      6,
    );
  });

  it('is zero when comparing a mix with itself', () => {
    const s = summarizeMix(base);
    expect(compareSummaries(s, s).every(r => r.difference === 0)).toBe(true);
  });
});

describe('monthlySeries', () => {
  it('adds the tracks month by month and ends at zero', () => {
    const summary = summarizeMix(createDefaultMix());
    const series = monthlySeries(summary);
    expect(series).toHaveLength(300); // the longest track: 25 years
    expect(series[0].payment).toBeCloseTo(summary.firstMonthlyPayment, 6);
    expect(series[series.length - 1].balance).toBe(0);
    expect(series[0].balance).toBeLessThan(summary.totalPrincipal * 1.01);
  });

  it('is empty for an empty mix', () => {
    expect(
      monthlySeries(summarizeMix({ ...createDefaultMix(), tracks: [] })),
    ).toEqual([]);
  });
});

describe('scheduleToCsv', () => {
  const labels = {
    track: 'Track',
    month: 'Month',
    rate: 'Rate',
    indexation: 'Indexation',
    payment: 'Payment',
    interest: 'Interest',
    principal: 'Principal',
    balance: 'Balance',
  };

  it('writes a header and one line per month of every track', () => {
    const mix = createDefaultMix();
    const csv = scheduleToCsv(mix, summarizeMix(mix), labels);
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toBe(
      'Track,Month,Rate,Indexation,Payment,Interest,Principal,Balance',
    );
    expect(lines).toHaveLength(1 + 300 + 300 + 240);
  });

  it('quotes names and neutralises formulas', () => {
    const mix = createDefaultMix();
    mix.tracks = [{ ...mix.tracks[2], name: '=SUM(A1), "x"', years: 1 }];
    const csv = scheduleToCsv(mix, summarizeMix(mix), labels);
    expect(csv.split('\r\n')[1].startsWith('"\'=SUM(A1), ""x""",1,')).toBe(
      true,
    );
  });

  it('keeps Hebrew text as is', () => {
    const mix = createDefaultMix();
    mix.tracks = [{ ...mix.tracks[2], name: 'קבועה', years: 1 }];
    expect(scheduleToCsv(mix, summarizeMix(mix), labels)).toContain('קבועה,1,');
  });
});
