import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  createDefaultMix,
  parseSavedMixes,
  sanitizeMix,
  serializeSavedMixes,
} from '@actual-app/core/shared/mortgage';
import type {
  MortgageMix,
  SavedMortgageMix,
} from '@actual-app/core/shared/mortgage';

import { useLocalPref } from '#hooks/useLocalPref';

type Draft = { mix: MortgageMix; savedId: string | null; name: string };

function parseDraft(raw: string | undefined): Draft | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const mix = sanitizeMix(data.mix);
    if (!mix) return null;
    return {
      mix,
      savedId: typeof data.savedId === 'string' ? data.savedId : null,
      name: typeof data.name === 'string' ? data.name : '',
    };
  } catch {
    return null;
  }
}

function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * The mortgage mix being edited, plus the user's named, saved mixes.
 * Both survive page reloads (stored per budget, in the browser).
 */
export function useMortgageMixes() {
  const { t } = useTranslation();
  const [draftRaw, setDraftRaw] = useLocalPref('mortgage.draft');
  const [savedRaw, setSavedRaw] = useLocalPref('mortgage.saved');

  const saved = parseSavedMixes(savedRaw);

  const [initial] = useState<Draft>(
    () =>
      parseDraft(draftRaw) ?? {
        mix: createDefaultMix({
          prime: t('Prime'),
          cpi: t('CPI-linked fixed'),
          fixed: t('Fixed, unlinked'),
        }),
        savedId: null,
        name: '',
      },
  );
  const [mix, setMixState] = useState<MortgageMix>(initial.mix);
  const [savedId, setSavedId] = useState<string | null>(initial.savedId);
  const [name, setNameState] = useState(initial.name);
  const [notice, setNotice] = useState<'saved' | 'nameMissing' | null>(null);

  const persistDraft = (next: Draft) => setDraftRaw(JSON.stringify(next));

  const setMix = (next: MortgageMix) => {
    setMixState(next);
    setNotice(null);
    persistDraft({ mix: next, savedId, name });
  };

  const setName = (next: string) => {
    setNameState(next);
    setNotice(null);
    persistDraft({ mix, savedId, name: next });
  };

  const writeSaved = (next: SavedMortgageMix[]) =>
    setSavedRaw(serializeSavedMixes(next));

  const save = (asNew: boolean) => {
    const trimmed = name.trim();
    if (trimmed === '') {
      setNotice('nameMissing');
      return;
    }
    const now = new Date().toISOString();
    const existing = asNew ? undefined : saved.find(s => s.id === savedId);
    const id = existing ? existing.id : newId();
    const entry: SavedMortgageMix = { id, name: trimmed, savedAt: now, mix };
    writeSaved(
      existing ? saved.map(s => (s.id === id ? entry : s)) : [...saved, entry],
    );
    setSavedId(id);
    setNotice('saved');
    persistDraft({ mix, savedId: id, name: trimmed });
  };

  const load = (id: string) => {
    const found = saved.find(s => s.id === id);
    if (!found) return;
    setMixState(found.mix);
    setSavedId(found.id);
    setNameState(found.name);
    setNotice(null);
    persistDraft({ mix: found.mix, savedId: found.id, name: found.name });
  };

  const remove = () => {
    if (!savedId) return;
    writeSaved(saved.filter(s => s.id !== savedId));
    setSavedId(null);
    setNotice(null);
    persistDraft({ mix, savedId: null, name });
  };

  const reset = () => {
    const fresh = createDefaultMix({
      prime: t('Prime'),
      cpi: t('CPI-linked fixed'),
      fixed: t('Fixed, unlinked'),
    });
    setMixState(fresh);
    setSavedId(null);
    setNameState('');
    setNotice(null);
    persistDraft({ mix: fresh, savedId: null, name: '' });
  };

  const selected = saved.find(s => s.id === savedId);
  const isDirty =
    !selected ||
    selected.name !== name.trim() ||
    JSON.stringify(selected.mix) !== JSON.stringify(mix);

  return {
    mix,
    setMix,
    saved,
    savedId,
    name,
    setName,
    notice,
    isDirty,
    save,
    load,
    remove,
    reset,
  };
}
