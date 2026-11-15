import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { summarizeMix, validateMix } from '@actual-app/core/shared/mortgage';

import { Page } from '#components/Page';

import { AssumptionsPanel } from './AssumptionsPanel';
import { MixToolbar } from './MixToolbar';
import { ScheduleSection } from './ScheduleSection';
import { SummaryCards } from './SummaryCards';
import { TracksTable } from './TracksTable';
import { useMortgageMixes } from './useMortgageMixes';

/**
 * Sela - Israeli mortgage calculator.
 *
 * Build a mix of tracks (prime, CPI-linked, fixed), see the payment and the
 * total cost (nominal and in today's money), try prime changes and a CPI
 * table, and save the mixes you want to compare. Calculations live in
 * `@actual-app/core/shared/mortgage`.
 */
export function MortgagePage() {
  const { t } = useTranslation();
  const mixes = useMortgageMixes();
  const { mix, setMix } = mixes;

  const summary = summarizeMix(mix);
  const issues = validateMix(mix);
  const mixIssues = issues.filter(issue => issue.trackId === null);

  return (
    <Page header={t('Mortgage calculator')}>
      <View
        style={{ gap: 24, paddingBottom: 40, maxWidth: 1100, flexShrink: 0 }}
      >
        <Text style={{ color: theme.pageTextSubdued }}>
          {t(
            'Build your mortgage mix from tracks, see the monthly payment and the total cost, and save the mixes you want to compare.',
          )}
        </Text>

        <MixToolbar
          saved={mixes.saved}
          savedId={mixes.savedId}
          name={mixes.name}
          notice={mixes.notice}
          isDirty={mixes.isDirty}
          onNameChange={mixes.setName}
          onLoad={mixes.load}
          onSave={mixes.save}
          onDelete={mixes.remove}
          onReset={mixes.reset}
        />

        <SummaryCards summary={summary} />

        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 18, fontWeight: 600 }}>
            <Trans>Assumptions</Trans>
          </Text>
          <AssumptionsPanel
            mix={mix}
            onChange={setMix}
            primeInvalid={mixIssues.some(issue => issue.field === 'prime')}
            cpiInvalid={mixIssues.some(issue => issue.field === 'cpi')}
          />
        </View>

        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 18, fontWeight: 600 }}>
            <Trans>Tracks</Trans>
          </Text>
          {mixIssues
            .filter(issue => issue.field === 'tracks')
            .map(issue => (
              <Text key={issue.code} style={{ color: theme.errorText }}>
                <Trans>Add at least one track to see a result.</Trans>
              </Text>
            ))}
          <TracksTable
            mix={mix}
            summary={summary}
            issues={issues}
            onChange={setMix}
          />
        </View>

        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 18, fontWeight: 600 }}>
            <Trans>Amortization schedule</Trans>
          </Text>
          <ScheduleSection mix={mix} summary={summary} />
        </View>
      </View>
    </Page>
  );
}
