import React from 'react';
import type { ReactNode } from 'react';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

type LabeledFieldProps = {
  label: string;
  children: ReactNode;
};

export function LabeledField({ label, children }: LabeledFieldProps) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontSize: 13, color: theme.pageTextSubdued }}>
        {label}
      </Text>
      {children}
    </View>
  );
}
