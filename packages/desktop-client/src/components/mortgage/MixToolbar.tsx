import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { SavedMortgageMix } from '@actual-app/core/shared/mortgage';

import { LabeledField } from './LabeledField';

type MixToolbarProps = {
  saved: SavedMortgageMix[];
  savedId: string | null;
  name: string;
  notice: 'saved' | 'nameMissing' | null;
  isDirty: boolean;
  onNameChange: (name: string) => void;
  onLoad: (id: string) => void;
  onSave: (asNew: boolean) => void;
  onDelete: () => void;
  onReset: () => void;
};

const NEW_MIX = '__new__';

export function MixToolbar({
  saved,
  savedId,
  name,
  notice,
  isDirty,
  onNameChange,
  onLoad,
  onSave,
  onDelete,
  onReset,
}: MixToolbarProps) {
  const { t } = useTranslation();

  const options: [string, string][] = [
    [NEW_MIX, t('Current mix (not saved)')],
    ...saved.map((s): [string, string] => [s.id, s.name]),
  ];

  const status =
    notice === 'nameMissing'
      ? t('Enter a name for the mix to save it.')
      : notice === 'saved'
        ? t('Saved. It will be here next time you open the page.')
        : savedId && !isDirty
          ? t('All changes are saved.')
          : savedId
            ? t('You have unsaved changes.')
            : t(
                'Your work is kept automatically. Save it with a name to come back to it later.',
              );

  return (
    <View style={{ gap: 10 }}>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'flex-end',
        }}
      >
        <LabeledField label={t('Saved mixes')}>
          <Select<string>
            options={options}
            value={savedId ?? NEW_MIX}
            onChange={id => (id === NEW_MIX ? onReset() : onLoad(id))}
            style={{ minWidth: 200 }}
          />
        </LabeledField>
        <LabeledField label={t('Mix name')}>
          <Input
            aria-label={t('Mix name')}
            aria-invalid={notice === 'nameMissing'}
            value={name}
            placeholder={t('For example: Plan with bank A')}
            onChangeValue={onNameChange}
            onEnter={() => onSave(false)}
            style={{ minWidth: 220 }}
          />
        </LabeledField>
        <Button variant="primary" onPress={() => onSave(false)}>
          {savedId ? t('Save changes') : t('Save mix')}
        </Button>
        {savedId && (
          <Button onPress={() => onSave(true)}>
            <Trans>Save as a new mix</Trans>
          </Button>
        )}
        {savedId && (
          <Button
            onPress={() => {
              if (window.confirm(t('Delete this saved mix?'))) onDelete();
            }}
          >
            <Trans>Delete</Trans>
          </Button>
        )}
        <Button variant="bare" onPress={onReset}>
          <Trans>Start over</Trans>
        </Button>
      </View>
      <Text
        style={{
          fontSize: 13,
          color:
            notice === 'nameMissing' ? theme.errorText : theme.pageTextSubdued,
        }}
      >
        {status}
      </Text>
    </View>
  );
}
