import React from 'react';
import { useTranslation } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import {
  debtToIncome,
  dtiBand,
  mixMonths,
  payoffMonth,
  realInterestCost,
} from '@actual-app/core/shared/mortgage';
import type { MixSummary, MortgageMix } from '@actual-app/core/shared/mortgage';

import { formatShekel } from './format';
import { LabeledField } from './LabeledField';
import { NumberField } from './NumberField';
import { SummaryCard } from './SummaryCard';

type DashboardSectionProps = {
  mix: MortgageMix;
  summary: MixSummary;
  onChange: (mix: MortgageMix) => void;
};

function formatMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('he-IL', {
    month: 'long',
    year: 'numeric',
  });
}

/** Debt-to-income, real cost of the interest and the payoff date. */
export function DashboardSection({
  mix,
  summary,
  onChange,
}: DashboardSectionProps) {
  const { t } = useTranslation();

  const ratio = debtToIncome(summary, mix.monthlyIncome);
  const band = ratio == null ? null : dtiBand(ratio);
  const months = mixMonths(summary);
  const payoff = payoffMonth(mix.startMonth, months);

  const bandText = {
    comfortable: t('Comfortable: up to 30% of the income.'),
    heavy: t('Heavy: between 30% and 40% of the income.'),
    risky: t(
      'High: more than 40% of the income. Consider a longer term or a smaller loan.',
    ),
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
        <LabeledField label={t('Household net income per month (₪)')}>
          <NumberField
            label={t('Household net income per month (₪)')}
            value={mix.monthlyIncome ?? 0}
            step={500}
            min={0}
            width={140}
            onChange={monthlyIncome =>
              onChange({
                ...mix,
                monthlyIncome: monthlyIncome > 0 ? monthlyIncome : undefined,
              })
            }
          />
        </LabeledField>
        <LabeledField label={t('Month of the first payment')}>
          <input
            type="month"
            aria-label={t('Month of the first payment')}
            dir="ltr"
            value={mix.startMonth ?? ''}
            onChange={event =>
              onChange({ ...mix, startMonth: event.target.value || undefined })
            }
            style={{
              padding: 5,
              borderRadius: 4,
              color: theme.formInputText,
              backgroundColor: theme.tableBackground,
              border: '1px solid ' + theme.formInputBorder,
            }}
          />
        </LabeledField>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <SummaryCard
          title={t('Debt-to-income ratio')}
          hint={
            band
              ? bandText[band]
              : t('Enter the household income to see the ratio.')
          }
        >
          {ratio == null ? '—' : `${(ratio * 100).toFixed(1)}%`}
        </SummaryCard>
        <SummaryCard
          title={t('Real cost of the interest')}
          hint={t(
            "What the loan costs in today's money, beyond the amount borrowed",
          )}
        >
          {formatShekel(realInterestCost(summary))}
        </SummaryCard>
        <SummaryCard
          title={t('Last payment')}
          hint={t('{{years}} years and {{months}} months of payments', {
            years: Math.floor(months / 12),
            months: months % 12,
          })}
        >
          {payoff ? formatMonth(payoff) : '—'}
        </SummaryCard>
      </View>

      <Text style={{ fontSize: 13, color: theme.pageTextSubdued }}>
        {t(
          'The ratio is an indication only, based on the first monthly payment. It is not financial advice.',
        )}
      </Text>
    </View>
  );
}
