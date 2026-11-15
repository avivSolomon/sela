import React, { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Block } from '@actual-app/components/block';
import { ButtonWithLoading } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { send } from '@actual-app/core/platform/client/connection';
import { q } from '@actual-app/core/shared/query';
import { format } from 'date-fns';

import { useMetadataPref } from '#hooks/useMetadataPref';

import { Setting } from './UI';

// Excel only reads UTF-8 CSV files as UTF-8 (instead of ANSI, which turns
// Hebrew into gibberish) when they start with a byte order mark.
const UTF8_BOM = '﻿';

export function ExportTransactionsCsv() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const [budgetName] = useMetadataPref('budgetName');

  async function onExport() {
    setIsLoading(true);
    setError(false);
    try {
      const csv = await send('transactions-export-query', {
        query: q('transactions').serialize(),
      });
      void window.Actual.saveFile(
        UTF8_BOM + csv,
        `${format(new Date(), 'yyyy-MM-dd')}-${budgetName ?? 'sela'}-transactions.csv`,
        t('Export transactions'),
      );
    } catch {
      setError(true);
    }
    setIsLoading(false);
  }

  return (
    <Setting
      primaryAction={
        <>
          <ButtonWithLoading onPress={onExport} isLoading={isLoading}>
            <Trans>Export all transactions (Excel / CSV)</Trans>
          </ButtonWithLoading>
          {error && (
            <Block style={{ color: theme.errorText, marginTop: 15 }}>
              <Trans>The export failed. Please try again.</Trans>
            </Block>
          )}
        </>
      }
    >
      <Text>
        <Trans>
          <strong>Export</strong> every transaction to one CSV file that opens
          in Excel, with Hebrew letters displayed correctly. Before you start
          entering real data, also save a full backup with "Export data".
        </Trans>
      </Text>
    </Setting>
  );
}
