import React, { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Select } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import {
  compareSummaries,
  summarizeMix,
} from '@actual-app/core/shared/mortgage';
import type {
  ComparisonKey,
  MortgageMix,
  SavedMortgageMix,
} from '@actual-app/core/shared/mortgage';

import { FinancialText } from '#components/FinancialText';

import { formatShekel } from './format';
import { LabeledField } from './LabeledField';

type CompareSectionProps = {
  mix: MortgageMix;
  saved: SavedMortgageMix[];
};

const cell = {
  textAlign: 'end',
  padding: '6px 10px',
  borderBottom: '1px solid ' + theme.tableBorder,
} as const;

const head = {
  ...cell,
  fontSize: 13,
  fontWeight: 600,
  color: theme.tableHeaderText,
} as const;

/** Puts the mix being edited next to one of the saved mixes. */
export function CompareSection({ mix, saved }: CompareSectionProps) {
  const { t } = useTranslation();
  const [otherId, setOtherId] = useState<string | null>(null);

  const labels: Record<ComparisonKey, string> = {
    firstMonthlyPayment: t('Monthly payment (first month)'),
    peakMonthlyPayment: t('Highest monthly payment'),
    totalInterest: t('Total interest'),
    totalIndexation: t('CPI linkage added'),
    totalPaid: t('Total you will pay'),
    realCost: t("Real cost (in today's money)"),
  };

  if (saved.length === 0) {
    return (
      <Text style={{ color: theme.pageTextSubdued }}>
        <Trans>
          Save at least one mix to compare it with the mix you are working on.
        </Trans>
      </Text>
    );
  }

  const other = saved.find(s => s.id === otherId) ?? saved[0];
  const rows = compareSummaries(summarizeMix(mix), summarizeMix(other.mix));
  const options: [string, string][] = saved.map(s => [s.id, s.name]);

  return (
    <View style={{ gap: 12 }}>
      <LabeledField label={t('Compare the current mix with')}>
        <Select<string>
          options={options}
          value={other.id}
          onChange={setOtherId}
          style={{ minWidth: 220 }}
        />
      </LabeledField>
      <View
        style={{
          overflowX: 'auto',
          border: '1px solid ' + theme.tableBorder,
          borderRadius: 6,
          backgroundColor: theme.tableBackground,
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...head, textAlign: 'start' }}>
                <Trans>Measure</Trans>
              </th>
              <th style={head}>
                <Trans>Current mix</Trans>
              </th>
              <th style={head}>{other.name}</th>
              <th style={head}>
                <Trans>Difference</Trans>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              // Words and a sign, not only color, say which mix is cheaper
              const diff = Math.round(row.difference);
              const text =
                diff === 0
                  ? t('Same')
                  : diff < 0
                    ? t('{{amount}} lower in the other mix', {
                        amount: formatShekel(-diff),
                      })
                    : t('{{amount}} higher in the other mix', {
                        amount: formatShekel(diff),
                      });
              return (
                <tr key={row.key}>
                  <td style={{ ...cell, textAlign: 'start' }}>
                    {labels[row.key]}
                  </td>
                  <td style={cell}>
                    <FinancialText>{formatShekel(row.a)}</FinancialText>
                  </td>
                  <td style={cell}>
                    <FinancialText>{formatShekel(row.b)}</FinancialText>
                  </td>
                  <td style={cell}>
                    <FinancialText>{text}</FinancialText>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </View>
    </View>
  );
}
