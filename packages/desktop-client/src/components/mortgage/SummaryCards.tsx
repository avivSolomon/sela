import React from 'react';
import { useTranslation } from 'react-i18next';

import { View } from '@actual-app/components/view';
import type { MixSummary } from '@actual-app/core/shared/mortgage';

import { formatShekel } from './format';
import { SummaryCard } from './SummaryCard';

export function SummaryCards({ summary }: { summary: MixSummary }) {
  const { t } = useTranslation();
  const peakDiffers =
    summary.peakMonthlyPayment > summary.firstMonthlyPayment * 1.01;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      <SummaryCard
        primary
        title={t('Monthly payment (first month)')}
        hint={
          peakDiffers
            ? t('Highest month: {{amount}}', {
                amount: formatShekel(summary.peakMonthlyPayment),
              })
            : undefined
        }
      >
        {formatShekel(summary.firstMonthlyPayment)}
      </SummaryCard>
      <SummaryCard title={t('Total loan')}>
        {formatShekel(summary.totalPrincipal)}
      </SummaryCard>
      <SummaryCard title={t('Total interest')}>
        {formatShekel(summary.totalInterest)}
      </SummaryCard>
      {summary.totalIndexation > 0 && (
        <SummaryCard
          title={t('CPI linkage added')}
          hint={t('Added to the principal of CPI-linked tracks')}
        >
          {formatShekel(summary.totalIndexation)}
        </SummaryCard>
      )}
      <SummaryCard title={t('Total you will pay')}>
        {formatShekel(summary.totalPaid)}
      </SummaryCard>
      <SummaryCard
        title={t("Real cost (in today's money)")}
        hint={t('Payments discounted by the expected CPI')}
      >
        {formatShekel(summary.realCost)}
      </SummaryCard>
    </View>
  );
}
