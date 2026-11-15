import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Select } from '@actual-app/components/select';
import { View } from '@actual-app/components/view';
import type { MixSummary, MortgageMix } from '@actual-app/core/shared/mortgage';

import { LabeledField } from './LabeledField';
import { toDisplayRows } from './scheduleRows';
import type { ScheduleView } from './scheduleRows';
import { ScheduleTable } from './ScheduleTable';

type ScheduleSectionProps = {
  mix: MortgageMix;
  summary: MixSummary;
};

export function ScheduleSection({ mix, summary }: ScheduleSectionProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [view, setView] = useState<ScheduleView>('first12');

  const track =
    mix.tracks.find(({ id }) => id === selectedId) ?? mix.tracks[0] ?? null;
  const index = track ? mix.tracks.indexOf(track) : -1;
  const schedule = index >= 0 ? summary.schedules[index] : null;
  if (!track || !schedule) return null;

  const trackOptions: [number, string][] = mix.tracks.map(({ id, name }) => [
    id,
    name || t('Unnamed track'),
  ]);
  const viewOptions: [ScheduleView, string][] = [
    ['first12', t('First 12 months')],
    ['yearly', t('By year')],
    ['monthly', t('All months')],
  ];

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <LabeledField label={t('Track')}>
          <Select<number>
            options={trackOptions}
            value={track.id}
            onChange={setSelectedId}
          />
        </LabeledField>
        <LabeledField label={t('Show')}>
          <Select<ScheduleView>
            options={viewOptions}
            value={view}
            onChange={setView}
          />
        </LabeledField>
      </View>
      <ScheduleTable
        rows={toDisplayRows(schedule.rows, view)}
        view={view}
        showIndexation={track.linkage === 'cpi'}
      />
    </View>
  );
}
