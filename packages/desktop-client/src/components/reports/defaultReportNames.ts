import type { TFunction } from 'i18next';

// The default dashboard ("Main") and its widgets are created with English
// names that are stored in the budget (loot-core: shared/dashboard.ts and the
// multiple-dashboards migration). There is no field that marks a name as a
// default one, so a stored name is shown translated only when it is exactly
// one of these original names; any name the user typed is shown as it is,
// and nothing stored in the budget is changed.
// Limitation: if a user types exactly one of these English names, it is
// shown translated too.

/** The widget name to show: translated if it is an original default name. */
export function displayWidgetName(name: string, t: TFunction): string;
export function displayWidgetName(
  name: string | undefined,
  t: TFunction,
): string | undefined;
export function displayWidgetName(
  name: string | undefined,
  t: TFunction,
): string | undefined {
  switch (name) {
    case 'Total Income (YTD)':
      return t('Total Income (YTD)');
    case 'Total Expenses (YTD)':
      return t('Total Expenses (YTD)');
    case 'Avg Per Month':
      return t('Avg Per Month');
    case 'Avg Per Transaction':
      return t('Avg Per Transaction');
    case 'This Month':
      return t('This Month');
    case 'Budget Overview':
      return t('Budget Overview');
    case '3-Month Average':
      return t('3-Month Average');
    case 'Transaction Calendar':
      return t('Transaction Calendar');
    case 'Recent Net Worth Change':
      return t('Recent Net Worth Change');
    default:
      return name;
  }
}

/** The dashboard name to show: translated if it is the original "Main". */
export function displayDashboardName(name: string, t: TFunction): string {
  return name === 'Main' ? t('Main') : name;
}
