import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { FinancialText } from '#components/FinancialText';

import { formatPercent, formatShekel } from './format';
import type { DisplayRow, ScheduleView } from './scheduleRows';

type ScheduleTableProps = {
  rows: DisplayRow[];
  view: ScheduleView;
  showIndexation: boolean;
};

const head = {
  textAlign: 'end',
  padding: '6px 10px',
  fontSize: 13,
  fontWeight: 600,
  color: theme.tableHeaderText,
  position: 'sticky',
  top: 0,
  backgroundColor: theme.tableRowHeaderBackground,
  borderBottom: '1px solid ' + theme.tableBorder,
} as const;

const cell = {
  textAlign: 'end',
  padding: '5px 10px',
  borderBottom: '1px solid ' + theme.tableBorder,
} as const;

export function ScheduleTable({
  rows,
  view,
  showIndexation,
}: ScheduleTableProps) {
  const { t } = useTranslation();

  return (
    <View
      style={{
        maxHeight: 360,
        overflow: 'auto',
        border: '1px solid ' + theme.tableBorder,
        borderRadius: 6,
        backgroundColor: theme.tableBackground,
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={head}>{view === 'yearly' ? t('Year') : t('Month')}</th>
            {view !== 'yearly' && (
              <th style={head}>
                <Trans>Rate</Trans>
              </th>
            )}
            {showIndexation && <th style={head}>{t('CPI linkage')}</th>}
            <th style={head}>
              <Trans>Payment</Trans>
            </th>
            <th style={head}>
              <Trans>Interest</Trans>
            </th>
            <th style={head}>
              <Trans>Principal</Trans>
            </th>
            <th style={head}>
              <Trans>Balance</Trans>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.key}>
              <td style={cell}>
                <FinancialText>{row.period}</FinancialText>
              </td>
              {view !== 'yearly' && (
                <td style={cell}>
                  <FinancialText>
                    {row.rate == null ? '' : formatPercent(row.rate)}
                  </FinancialText>
                </td>
              )}
              {showIndexation && (
                <td style={cell}>
                  <FinancialText>{formatShekel(row.indexation)}</FinancialText>
                </td>
              )}
              <td style={cell}>
                <FinancialText>{formatShekel(row.payment)}</FinancialText>
              </td>
              <td style={cell}>
                <FinancialText>{formatShekel(row.interest)}</FinancialText>
              </td>
              <td style={cell}>
                <FinancialText>{formatShekel(row.principal)}</FinancialText>
              </td>
              <td style={cell}>
                <FinancialText>{formatShekel(row.balance)}</FinancialText>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </View>
  );
}
