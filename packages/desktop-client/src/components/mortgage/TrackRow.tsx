import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import type {
  LinkageType,
  MortgageTrack,
  ValidationIssue,
} from '@actual-app/core/shared/mortgage';

import { FinancialText } from '#components/FinancialText';

import { formatPercent, formatShekel } from './format';
import { issueMessage } from './issueMessage';
import { NumberField } from './NumberField';

type TrackRowProps = {
  track: MortgageTrack;
  issues: ValidationIssue[];
  effectiveRate: number;
  monthly: number;
  onChange: (patch: Partial<MortgageTrack>) => void;
  onRemove: () => void;
};

const cell = { padding: '6px 6px', verticalAlign: 'top' } as const;

export function TrackRow({
  track,
  issues,
  effectiveRate,
  monthly,
  onChange,
  onRemove,
}: TrackRowProps) {
  const { t } = useTranslation();
  const has = (field: ValidationIssue['field']) =>
    issues.some(issue => issue.field === field);

  const linkageOptions: [LinkageType, string][] = [
    ['prime', t('Prime')],
    ['cpi', t('CPI-linked')],
    ['fixed', t('Fixed, unlinked')],
  ];

  return (
    <>
      <tr>
        <td style={cell}>
          <Input
            aria-label={t('Track name')}
            aria-invalid={has('name')}
            value={track.name}
            onChangeValue={name => onChange({ name })}
            style={{ minWidth: 140 }}
          />
        </td>
        <td style={cell}>
          <Select<LinkageType>
            options={linkageOptions}
            value={track.linkage}
            onChange={linkage => onChange({ linkage })}
          />
        </td>
        <td style={cell}>
          <NumberField
            label={t('Loan amount (₪)')}
            value={track.principal}
            step={1000}
            min={0}
            invalid={has('principal')}
            width={120}
            onChange={principal => onChange({ principal })}
          />
        </td>
        <td style={cell}>
          <NumberField
            label={
              track.linkage === 'prime'
                ? t('Margin over prime (%)')
                : t('Annual rate (%)')
            }
            value={track.annualRate}
            step={0.05}
            invalid={has('rate')}
            width={90}
            onChange={annualRate => onChange({ annualRate })}
          />
        </td>
        <td style={cell}>
          <NumberField
            label={t('Years')}
            value={track.years}
            step={1}
            min={1}
            invalid={has('years')}
            width={70}
            onChange={years => onChange({ years })}
          />
        </td>
        <td style={{ ...cell, textAlign: 'end' }}>
          <FinancialText>{formatPercent(effectiveRate)}</FinancialText>
        </td>
        <td style={{ ...cell, textAlign: 'end', fontWeight: 600 }}>
          <FinancialText style={{ color: theme.pageText }}>
            {formatShekel(monthly)}
          </FinancialText>
        </td>
        <td style={cell}>
          <Button variant="bare" onPress={onRemove}>
            <Trans>Remove</Trans>
          </Button>
        </td>
      </tr>
      {issues.length > 0 && (
        <tr>
          <td colSpan={8} style={{ padding: '0 6px 8px' }}>
            {issues.map(issue => (
              <Text
                key={`${issue.field}:${issue.code}`}
                style={{
                  display: 'block',
                  color: theme.errorText,
                  fontSize: 13,
                }}
              >
                {issueMessage(issue, t)}
              </Text>
            ))}
          </td>
        </tr>
      )}
    </>
  );
}
