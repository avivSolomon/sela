import React from 'react';
import { useTranslation } from 'react-i18next';

import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { monthlySeries } from '@actual-app/core/shared/mortgage';
import type { MixSummary } from '@actual-app/core/shared/mortgage';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatShekel } from './format';

type BalanceChartProps = {
  summary: MixSummary;
};

/** Outstanding principal and the total monthly payment over the loan's life. */
export function BalanceChart({ summary }: BalanceChartProps) {
  const { t } = useTranslation();
  const data = monthlySeries(summary).map(point => ({
    ...point,
    year: point.month / 12,
  }));
  if (data.length === 0) return null;

  const balanceLabel = t('Balance');
  const paymentLabel = t('Monthly payment');

  return (
    <View
      style={{ height: 280, direction: 'ltr' }}
      role="img"
      aria-label={t('Balance and monthly payment over the years')}
    >
      <ResponsiveContainer>
        <LineChart
          data={data}
          margin={{ top: 10, right: 16, bottom: 4, left: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={theme.tableBorder} />
          <XAxis
            dataKey="year"
            type="number"
            domain={[0, 'dataMax']}
            tickFormatter={(year: number) => String(Math.round(year))}
            tick={{ fill: theme.pageTextSubdued, fontSize: 12 }}
            label={{
              value: t('Years'),
              position: 'insideBottomRight',
              offset: -2,
              fill: theme.pageTextSubdued,
              fontSize: 12,
            }}
          />
          <YAxis
            yAxisId="balance"
            tickFormatter={(value: number) => formatShekel(value)}
            tick={{ fill: theme.pageTextSubdued, fontSize: 12 }}
            width={80}
          />
          <YAxis
            yAxisId="payment"
            orientation="right"
            tickFormatter={(value: number) => formatShekel(value)}
            tick={{ fill: theme.pageTextSubdued, fontSize: 12 }}
            width={70}
          />
          <Tooltip
            labelFormatter={year =>
              t('Month {{month}}', { month: Math.round(Number(year) * 12) })
            }
            formatter={(value, name) => [formatShekel(Number(value)), name]}
            contentStyle={{
              backgroundColor: theme.menuBackground,
              color: theme.menuItemText,
              border: '1px solid ' + theme.tableBorder,
            }}
          />
          <Legend />
          <Line
            yAxisId="balance"
            type="monotone"
            dataKey="balance"
            name={balanceLabel}
            stroke={theme.reportsBlue}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            yAxisId="payment"
            type="stepAfter"
            dataKey="payment"
            name={paymentLabel}
            stroke={theme.reportsRed}
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </View>
  );
}
