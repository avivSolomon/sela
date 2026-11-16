import type { TFunction } from 'i18next';

import { displayDashboardName, displayWidgetName } from './defaultReportNames';

// A stand-in for i18next's t(): marks every translated string.
const t = ((key: string) => `[he] ${key}`) as unknown as TFunction;

describe('default report names', () => {
  it('translates the original default widget names', () => {
    for (const name of [
      'Total Income (YTD)',
      'Total Expenses (YTD)',
      'Avg Per Month',
      'Avg Per Transaction',
      'This Month',
      'Budget Overview',
      '3-Month Average',
      'Transaction Calendar',
      'Recent Net Worth Change',
    ]) {
      expect(displayWidgetName(name, t)).toBe(`[he] ${name}`);
    }
  });

  it('keeps names that the user typed', () => {
    expect(displayWidgetName('My groceries', t)).toBe('My groceries');
    expect(displayWidgetName('this month', t)).toBe('this month');
    expect(displayWidgetName('החודש שלי', t)).toBe('החודש שלי');
  });

  it('keeps an empty name empty, so the page default is used', () => {
    expect(displayWidgetName(undefined, t)).toBeUndefined();
    expect(displayWidgetName('', t)).toBe('');
  });

  it('translates only the original dashboard name', () => {
    expect(displayDashboardName('Main', t)).toBe('[he] Main');
    expect(displayDashboardName('Main 2', t)).toBe('Main 2');
    expect(displayDashboardName('הלוח שלי', t)).toBe('הלוח שלי');
  });
});
