import React from 'react';
import type { ReactNode } from 'react';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { FinancialText } from '#components/FinancialText';

type SummaryCardProps = {
  title: string;
  hint?: string;
  children: ReactNode;
  primary?: boolean;
};

export function SummaryCard({
  title,
  hint,
  children,
  primary = false,
}: SummaryCardProps) {
  return (
    <View
      style={{
        flex: '1 1 170px',
        minWidth: 170,
        padding: '12px 16px',
        borderRadius: 6,
        border: '1px solid ' + theme.tableBorder,
        backgroundColor: primary
          ? theme.tableRowHeaderBackground
          : theme.tableBackground,
      }}
    >
      <Text style={{ color: theme.pageTextSubdued, fontSize: 13 }}>
        {title}
      </Text>
      <FinancialText
        style={{ fontSize: primary ? 26 : 20, fontWeight: 600, marginTop: 4 }}
      >
        {children}
      </FinancialText>
      {hint && (
        <Text
          style={{ color: theme.pageTextSubdued, fontSize: 12, marginTop: 4 }}
        >
          {hint}
        </Text>
      )}
    </View>
  );
}
