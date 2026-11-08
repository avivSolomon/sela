import { useEffect, useRef } from 'react';

import { createBudget } from '#budgetfiles/budgetfilesSlice';
import { useDispatch } from '#redux';

// Sela has no setup choices: the first launch creates a local budget and
// opens it straight away, with every feature available.
export function WelcomeScreen() {
  const dispatch = useDispatch();
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) {
      return;
    }
    hasStarted.current = true;
    void dispatch(createBudget({}));
  }, [dispatch]);

  return null;
}
