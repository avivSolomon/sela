import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { effectiveAnnualRate } from '@actual-app/core/shared/mortgage';
import type {
  MixSummary,
  MortgageMix,
  MortgageTrack,
  ValidationIssue,
} from '@actual-app/core/shared/mortgage';

import { TrackCard } from './TrackCard';
import { TrackRow } from './TrackRow';

type TracksTableProps = {
  mix: MortgageMix;
  summary: MixSummary;
  issues: ValidationIssue[];
  onChange: (mix: MortgageMix) => void;
};

const headerCell = {
  textAlign: 'start',
  padding: '8px 6px',
  fontSize: 13,
  fontWeight: 600,
  color: theme.tableHeaderText,
  borderBottom: '1px solid ' + theme.tableBorder,
} as const;

export function TracksTable({
  mix,
  summary,
  issues,
  onChange,
}: TracksTableProps) {
  const { t } = useTranslation();
  const { isNarrowWidth } = useResponsive();

  const updateTrack = (id: number, patch: Partial<MortgageTrack>) =>
    onChange({
      ...mix,
      tracks: mix.tracks.map(track =>
        track.id === id ? { ...track, ...patch } : track,
      ),
    });

  const addTrack = () => {
    const nextId = Math.max(0, ...mix.tracks.map(track => track.id)) + 1;
    onChange({
      ...mix,
      tracks: [
        ...mix.tracks,
        {
          id: nextId,
          name: t('New track'),
          principal: 100000,
          annualRate: 4,
          years: 20,
          linkage: 'fixed',
          rateChanges: [],
        },
      ],
    });
  };

  const removeTrack = (id: number) =>
    onChange({ ...mix, tracks: mix.tracks.filter(track => track.id !== id) });

  return (
    <View style={{ gap: 10 }}>
      {isNarrowWidth ? (
        <View style={{ gap: 10 }}>
          {mix.tracks.map((track, index) => (
            <TrackCard
              key={track.id}
              track={track}
              issues={issues.filter(issue => issue.trackId === track.id)}
              effectiveRate={effectiveAnnualRate(track, 1, mix)}
              monthly={summary.schedules[index]?.monthly ?? 0}
              onChange={patch => updateTrack(track.id, patch)}
              onRemove={() => removeTrack(track.id)}
            />
          ))}
        </View>
      ) : (
        <View
          style={{
            overflowX: 'auto',
            border: '1px solid ' + theme.tableBorder,
            borderRadius: 6,
            backgroundColor: theme.tableBackground,
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={headerCell}>
                  <Trans>Track</Trans>
                </th>
                <th style={headerCell}>
                  <Trans>Type</Trans>
                </th>
                <th style={headerCell}>{t('Loan amount (₪)')}</th>
                <th style={headerCell}>{t('Rate / margin (%)')}</th>
                <th style={headerCell}>
                  <Trans>Years</Trans>
                </th>
                <th style={{ ...headerCell, textAlign: 'end' }}>
                  <Trans>Rate today</Trans>
                </th>
                <th style={{ ...headerCell, textAlign: 'end' }}>
                  <Trans>Monthly payment</Trans>
                </th>
                <th style={headerCell} />
              </tr>
            </thead>
            <tbody>
              {mix.tracks.map((track, index) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  issues={issues.filter(issue => issue.trackId === track.id)}
                  effectiveRate={effectiveAnnualRate(track, 1, mix)}
                  monthly={summary.schedules[index]?.monthly ?? 0}
                  onChange={patch => updateTrack(track.id, patch)}
                  onRemove={() =>
                    onChange({
                      ...mix,
                      tracks: mix.tracks.filter(({ id }) => id !== track.id),
                    })
                  }
                />
              ))}
            </tbody>
          </table>
        </View>
      )}

      <View style={{ alignItems: 'flex-start' }}>
        <Button variant="primary" onPress={addTrack}>
          <Trans>Add a track</Trans>
        </Button>
      </View>

      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 13, color: theme.pageTextSubdued }}>
          {t(
            'Prime: the rate moves with the Bank of Israel prime rate. Enter only the margin above (or below) the prime, for example -0.5.',
          )}
        </Text>
        <Text style={{ fontSize: 13, color: theme.pageTextSubdued }}>
          {t(
            'CPI-linked: the loan amount grows every month with the consumer price index, so the payment rises when prices rise.',
          )}
        </Text>
        <Text style={{ fontSize: 13, color: theme.pageTextSubdued }}>
          {t('Fixed, unlinked: the rate and the payment stay constant.')}
        </Text>
      </View>
    </View>
  );
}
