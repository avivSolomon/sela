import { parse as csvParse } from 'csv-parse/sync';
import { describe, expect, it, vi } from 'vitest';

import { aqlQuery } from '#server/aql';

import { exportQueryToCSV } from './export-to-csv';

vi.mock('#server/aql', () => ({ aqlQuery: vi.fn() }));

// exportQueryToCSV only chains `select(...).options(...)` on the query it gets.
const fakeQuery = {
  select() {
    return this;
  },
  options() {
    return this;
  },
} as never;

const HEADER = [
  'Account',
  'Date',
  'Payee',
  'Notes',
  'Category_Group',
  'Category',
  'Amount',
  'Split_Amount',
  'Cleared',
];

describe('exportQueryToCSV', () => {
  it('keeps the header row when there are no transactions', async () => {
    vi.mocked(aqlQuery).mockResolvedValue({ data: [], dependencies: [] });

    const csv = await exportQueryToCSV(fakeQuery);

    expect(csv.trim().split('\n')).toEqual([HEADER.join(',')]);
  });

  it('exports Hebrew text unchanged, in the header column order', async () => {
    vi.mocked(aqlQuery).mockResolvedValue({
      dependencies: [],
      data: [
        {
          Id: '1',
          Account: 'חשבון עו"ש',
          Date: '2026-11-15',
          Payee: 'סופר',
          ParentId: null,
          IsParent: false,
          IsChild: false,
          SortOrder: 1,
          Notes: 'קניות לשבת',
          CategoryGroup: 'הוצאות שוטפות',
          Category: 'מזון',
          Amount: -12345,
          Cleared: true,
          Reconciled: false,
        },
      ],
    });

    const csv = await exportQueryToCSV(fakeQuery);
    const rows: Record<string, string>[] = csvParse(csv, { columns: true });

    expect(Object.keys(rows[0])).toEqual(HEADER);
    expect(rows[0]).toMatchObject({
      Account: 'חשבון עו"ש',
      Payee: 'סופר',
      Category_Group: 'הוצאות שוטפות',
      Category: 'מזון',
      Amount: '-123.45',
      Cleared: 'Cleared',
    });
  });
});
