import { useState, useCallback } from 'react';
import { guardarVersion, restaurarPlan } from '../rutina.js';
import { estadoGuardado } from './persistencia.js';

// ═══════════════ RUTINAS VERSIONADAS ═══════════════
// Versiones de rutina encima del plan base. El pasado no se reescribe: cada
// edición se guarda como versión desde hoy, y las fechas anteriores siguen
// resolviendo lo que se entrenó entonces (ver rutina.js).
export function useRutinas({ todayISO }) {
  const [rutina, setRutina] = useState(() => estadoGuardado().rutina ?? {});

  const guardarRutina = useCallback((sesionKey, ejercicios, motivo) => {
    setRutina(prev => guardarVersion(prev, sesionKey, ejercicios, todayISO, motivo));
  }, [todayISO]);

  const restaurarRutina = useCallback((sesionKey) => {
    setRutina(prev => restaurarPlan(prev, sesionKey, todayISO));
  }, [todayISO]);

  return { rutina, setRutina, guardarRutina, restaurarRutina };
}
