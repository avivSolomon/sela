import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { parseCpiTable } from '@actual-app/core/shared/mortgage';

type CpiImportButtonProps = {
  /** Called with the monthly CPI changes (%) read from the file. */
  onImport: (monthlyPercent: number[]) => void;
};

/** Lets the user load a CPI table from a CSV/text file instead of typing it. */
export function CpiImportButton({ onImport }: CpiImportButtonProps) {
  const { t } = useTranslation();
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const values = parseCpiTable(await file.text());
    if (values.length === 0) {
      setMessage({
        ok: false,
        text: t('No CPI values were found in this file.'),
      });
    } else {
      onImport(values);
      setMessage({
        ok: true,
        text: t('Imported {{count}} months of CPI.', { count: values.length }),
      });
    }
    // allow choosing the same file again
    if (fileInput.current) fileInput.current.value = '';
  };

  return (
    <View style={{ gap: 6, alignItems: 'flex-start' }}>
      <input
        ref={fileInput}
        type="file"
        accept=".csv,.txt,text/csv,text/plain"
        aria-label={t('Import CPI table from a file')}
        style={{ display: 'none' }}
        onChange={event => void onFile(event.target.files?.[0])}
      />
      <Button onPress={() => fileInput.current?.click()}>
        {t('Import CPI table from a file')}
      </Button>
      {message && (
        <Text
          style={{
            fontSize: 13,
            color: message.ok ? theme.pageTextSubdued : theme.errorText,
          }}
        >
          {message.text}
        </Text>
      )}
    </View>
  );
}
