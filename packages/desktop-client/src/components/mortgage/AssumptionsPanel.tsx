import React, { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { MortgageMix, RateChange } from '@actual-app/core/shared/mortgage';

import { parseNumberList } from './format';
import { LabeledField } from './LabeledField';
import { NumberField } from './NumberField';

type AssumptionsPanelProps = {
  mix: MortgageMix;
  onChange: (mix: MortgageMix) => void;
  primeInvalid: boolean;
  cpiInvalid: boolean;
};

export function AssumptionsPanel({
  mix,
  onChange,
  primeInvalid,
  cpiInvalid,
}: AssumptionsPanelProps) {
  const { t } = useTranslation();
  const [showAdvanced, setShowAdvanced] = useState(
    mix.primeChanges.length > 0 ||
      mix.cpi.overrides.length > 0 ||
      mix.cpi.monthlyPercent.length > 0,
  );
  const [cpiTableText, setCpiTableText] = useState(
    mix.cpi.monthlyPercent.join(', '),
  );

  const setPrimeChange = (index: number, patch: Partial<RateChange>) =>
    onChange({
      ...mix,
      primeChanges: mix.primeChanges.map((change, i) =>
        i === index ? { ...change, ...patch } : change,
      ),
    });

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
        <LabeledField label={t('Prime rate (%)')}>
          <NumberField
            label={t('Prime rate (%)')}
            value={mix.prime}
            step={0.05}
            invalid={primeInvalid}
            onChange={prime => onChange({ ...mix, prime })}
          />
        </LabeledField>
        <LabeledField label={t('Expected CPI per year (%)')}>
          <NumberField
            label={t('Expected CPI per year (%)')}
            value={mix.cpi.defaultAnnualPercent}
            step={0.1}
            invalid={cpiInvalid}
            onChange={defaultAnnualPercent =>
              onChange({ ...mix, cpi: { ...mix.cpi, defaultAnnualPercent } })
            }
          />
        </LabeledField>
      </View>

      <View style={{ alignItems: 'flex-start' }}>
        <Button variant="bare" onPress={() => setShowAdvanced(!showAdvanced)}>
          {showAdvanced
            ? t('Hide advanced assumptions')
            : t('Advanced: rate changes and CPI table')}
        </Button>
      </View>

      {showAdvanced && (
        <View style={{ gap: 16 }}>
          <View style={{ gap: 8 }}>
            <Text style={{ fontWeight: 600 }}>
              <Trans>Prime rate changes</Trans>
            </Text>
            <Text style={{ fontSize: 13, color: theme.pageTextSubdued }}>
              {t(
                'Test what happens if the prime changes. Prime tracks are re-priced from the chosen month and the payment is recalculated.',
              )}
            </Text>
            {mix.primeChanges.map((change, index) => (
              <View
                key={index}
                style={{
                  flexDirection: 'row',
                  gap: 12,
                  alignItems: 'flex-end',
                }}
              >
                <LabeledField label={t('From month')}>
                  <NumberField
                    label={t('From month')}
                    value={change.fromMonth}
                    min={1}
                    onChange={fromMonth => setPrimeChange(index, { fromMonth })}
                  />
                </LabeledField>
                <LabeledField label={t('New prime (%)')}>
                  <NumberField
                    label={t('New prime (%)')}
                    value={change.annualRate}
                    step={0.05}
                    onChange={annualRate =>
                      setPrimeChange(index, { annualRate })
                    }
                  />
                </LabeledField>
                <Button
                  variant="bare"
                  onPress={() =>
                    onChange({
                      ...mix,
                      primeChanges: mix.primeChanges.filter(
                        (_, i) => i !== index,
                      ),
                    })
                  }
                >
                  <Trans>Remove</Trans>
                </Button>
              </View>
            ))}
            <View style={{ alignItems: 'flex-start' }}>
              <Button
                onPress={() =>
                  onChange({
                    ...mix,
                    primeChanges: [
                      ...mix.primeChanges,
                      { fromMonth: 13, annualRate: mix.prime },
                    ],
                  })
                }
              >
                <Trans>Add a prime change</Trans>
              </Button>
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <Text style={{ fontWeight: 600 }}>{t('CPI table')}</Text>
            <Text style={{ fontSize: 13, color: theme.pageTextSubdued }}>
              {t(
                'Optional: enter the monthly CPI changes (%) separated by commas, starting from month 1. Months without a value use the expected yearly CPI above.',
              )}
            </Text>
            <textarea
              aria-label={t('CPI table')}
              dir="ltr"
              rows={2}
              value={cpiTableText}
              placeholder="0.3, 0.1, -0.1, 0.4"
              onChange={event => {
                setCpiTableText(event.target.value);
                onChange({
                  ...mix,
                  cpi: {
                    ...mix.cpi,
                    monthlyPercent: parseNumberList(event.target.value),
                  },
                });
              }}
              style={{
                width: '100%',
                maxWidth: 520,
                padding: 6,
                borderRadius: 4,
                color: theme.formInputText,
                backgroundColor: theme.tableBackground,
                border: '1px solid ' + theme.formInputBorder,
              }}
            />
          </View>
        </View>
      )}
    </View>
  );
}
