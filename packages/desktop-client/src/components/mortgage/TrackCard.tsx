import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type {
  LinkageType,
  MortgageTrack,
  ValidationIssue,
} from '@actual-app/core/shared/mortgage';

import { FinancialText } from '#components/FinancialText';

import { formatPercent, formatShekel } from './format';
import { issueMessage } from './issueMessage';
import { LabeledField } from './LabeledField';
import { NumberField } from './NumberField';

type TrackCardProps = {
  track: MortgageTrack;
  issues: ValidationIssue[];
  effectiveRate: number;
  monthly: number;
  onChange: (patch: Partial<MortgageTrack>) => void;
  onRemove: () => void;
};

/** One track as a stacked card: the layout used on narrow (phone) screens. */
export function TrackCard({
  track,
  issues,
  effectiveRate,
  monthly,
  onChange,
  onRemove,
}: TrackCardProps) {
  const { t } = useTranslation();
  const has = (field: ValidationIssue['field']) =>
    issues.some(issue => issue.field === field);

  const linkageOptions: [LinkageType, string][] = [
    ['prime', t('Prime')],
    ['cpi', t('CPI-linked')],
    ['fixed', t('Fixed, unlinked')],
  ];

  return (
    <View
      style={{
        gap: 10,
        padding: 12,
        borderRadius: 6,
        border: '1px solid ' + theme.tableBorder,
        backgroundColor: theme.tableBackground,
      }}
    >
      <LabeledField label={t('Track name')}>
        <Input
          aria-label={t('Track name')}
          aria-invalid={has('name')}
          value={track.name}
          onChangeValue={name => onChange({ name })}
        />
      </LabeledField>
      <LabeledField label={t('Type')}>
        <Select<LinkageType>
          options={linkageOptions}
          value={track.linkage}
          onChange={linkage => onChange({ linkage })}
        />
      </LabeledField>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <LabeledField label={t('Loan amount (₪)')}>
          <NumberField
            label={t('Loan amount (₪)')}
            value={track.principal}
            step={1000}
            min={0}
            invalid={has('principal')}
            width={130}
            onChange={principal => onChange({ principal })}
          />
        </LabeledField>
        <LabeledField
          label={
            track.linkage === 'prime'
              ? t('Margin over prime (%)')
              : t('Annual rate (%)')
          }
        >
          <NumberField
            label={
              track.linkage === 'prime'
                ? t('Margin over prime (%)')
                : t('Annual rate (%)')
            }
            value={track.annualRate}
            step={0.05}
            invalid={has('rate')}
            width={100}
            onChange={annualRate => onChange({ annualRate })}
          />
        </LabeledField>
        <LabeledField label={t('Years')}>
          <NumberField
            label={t('Years')}
            value={track.years}
            step={1}
            min={1}
            invalid={has('years')}
            width={80}
            onChange={years => onChange({ years })}
          />
        </LabeledField>
      </View>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <View>
          <Text style={{ fontSize: 13, color: theme.pageTextSubdued }}>
            <Trans>Rate today</Trans>:{' '}
            <FinancialText>{formatPercent(effectiveRate)}</FinancialText>
          </Text>
          <Text style={{ fontWeight: 600 }}>
            <Trans>Monthly payment</Trans>:{' '}
            <FinancialText>{formatShekel(monthly)}</FinancialText>
          </Text>
        </View>
        <Button onPress={onRemove}>
          <Trans>Remove</Trans>
        </Button>
      </View>
      {issues.map(issue => (
        <Text
          key={`${issue.field}:${issue.code}`}
          style={{ color: theme.errorText, fontSize: 13 }}
        >
          {issueMessage(issue, t)}
        </Text>
      ))}
    </View>
  );
}
