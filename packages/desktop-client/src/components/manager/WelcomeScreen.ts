import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { createBudget } from '#budgetfiles/budgetfilesSlice';
import { useDispatch } from '#redux';

// Sela has no setup choices: the first launch creates a local budget and
// opens it straight away, with every feature available.
export function WelcomeScreen() {
  const dispatch = useDispatch();
  // Wait until the translations are loaded, or the budget would get the
  // English name.
  const { t, ready } = useTranslation();
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current || !ready) {
      return;
    }
    hasStarted.current = true;
    void dispatch(createBudget({ budgetName: t('My Finances') }));
  }, [dispatch, t, ready]);

  return null;
}
