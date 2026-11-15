import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { View } from '@actual-app/components/view';
import {
  effectiveAnnualRate,
  monthlySeries,
  scheduleToCsv,
} from '@actual-app/core/shared/mortgage';
import type { MixSummary, MortgageMix } from '@actual-app/core/shared/mortgage';

import { formatPercent, formatShekel } from './format';
import { buildPrintHtml } from './printHtml';

type ExportButtonsProps = {
  mix: MortgageMix;
  summary: MixSummary;
  /** Name of the saved mix, used in the title when there is one. */
  mixName: string;
};

// Excel reads a UTF-8 CSV as UTF-8 (so Hebrew displays correctly) only with a BOM.
const UTF8_BOM = '﻿';

export function ExportButtons({ mix, summary, mixName }: ExportButtonsProps) {
  const { t } = useTranslation();

  const exportCsv = () => {
    const csv = scheduleToCsv(mix, summary, {
      track: t('Track'),
      month: t('Month'),
      rate: t('Rate'),
      indexation: t('CPI linkage'),
      payment: t('Payment'),
      interest: t('Interest'),
      principal: t('Principal'),
      balance: t('Balance'),
    });
    void window.Actual.saveFile(
      UTF8_BOM + csv,
      'sela-mortgage-schedule.csv',
      t('Export amortization schedule'),
    );
  };

  const print = () => {
    const linkage = {
      prime: t('Prime'),
      cpi: t('CPI-linked'),
      fixed: t('Fixed, unlinked'),
    };
    const series = monthlySeries(summary);
    const yearly: string[][] = [];
    for (let year = 1; year * 12 - 11 <= series.length; year++) {
      const months = series.slice((year - 1) * 12, year * 12);
      const paid = months.reduce((sum, m) => sum + m.payment, 0);
      yearly.push([
        String(year),
        formatShekel(paid),
        formatShekel(months[months.length - 1].balance),
      ]);
    }

    const html = buildPrintHtml({
      title: mixName
        ? t('Mortgage mix: {{name}}', { name: mixName })
        : t('Mortgage mix'),
      subtitle: new Date().toLocaleDateString('he-IL'),
      summary: [
        {
          label: t('Monthly payment (first month)'),
          value: formatShekel(summary.firstMonthlyPayment),
        },
        { label: t('Total loan'), value: formatShekel(summary.totalPrincipal) },
        {
          label: t('Total interest'),
          value: formatShekel(summary.totalInterest),
        },
        {
          label: t('Total you will pay'),
          value: formatShekel(summary.totalPaid),
        },
        {
          label: t("Real cost (in today's money)"),
          value: formatShekel(summary.realCost),
        },
      ],
      tracksTitle: t('Tracks'),
      trackHeads: [
        t('Track'),
        t('Type'),
        t('Loan amount (₪)'),
        t('Rate today'),
        t('Years'),
        t('Monthly payment'),
      ],
      trackRows: mix.tracks.map((track, index) => [
        track.name,
        linkage[track.linkage],
        formatShekel(track.principal),
        formatPercent(effectiveAnnualRate(track, 1, mix)),
        String(track.years),
        formatShekel(summary.schedules[index]?.monthly ?? 0),
      ]),
      scheduleTitle: t('Amortization schedule'),
      scheduleHeads: [t('Year'), t('Payment'), t('Balance')],
      scheduleRows: yearly,
      footer: t(
        'Calculated by Sela from the assumptions above. Not a bank offer; actual terms may differ.',
      ),
    });

    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      <Button onPress={exportCsv}>{t('Export schedule (Excel / CSV)')}</Button>
      <Button onPress={print}>{t('Print or save as PDF')}</Button>
    </View>
  );
}
