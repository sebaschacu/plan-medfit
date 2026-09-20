import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { SESIONES } from '../data.js';
import { calcularAvisosReset } from '../reglas.js';
import { parseRest } from '../utiles/formato.js';
import { vibrate } from '../utiles/sonido.js';
import { estadoGuardado } from './persistencia.js';

// ═══════════════ PROGRESO Y PRs ═══════════════
// Lo que se registra al entrenar: series, cargas, lastre, banda, sueño. Es el
// estado más volátil de la app (cambia en cada toque de serie), así que en el
// paso 7 va a su propio contexto para no arrastrar al calendario.
//
// Toda mutación sobre el día activo lo FIJA primero (fijarPorRegistro): sin
// eso, editar otro día recalcularía el calendario y podría cambiarle la sesión,
// dejando el registro con IDs de ejercicios que ya no existen ahí.
export function useProgreso({ activeFecha, diaActivo, fijarPorRegistro, startTimer }) {
  const [progress, setProgress] = useState(() => estadoGuardado().prog); // { 'YYYY-MM-DD': { exId: {sets,logs} } }
  const [prMap, setPrMap] = useState(() => estadoGuardado().prs);        // { exId: {kg, flash} }

  // ─── PR detector ───
  // El updater de setPrMap tiene que ser PURO. Antes llamaba a vibrate() y
  // programaba un setTimeout dentro: React invoca los updaters dos veces en
  // StrictMode, así que vibraba dos veces y dejaba dos temporizadores sueltos.
  // Es el mismo error que el de la navegación de mes. Ahora la comparación se
  // hace contra un ref y los efectos ocurren fuera del updater.
  const prMapRef = useRef(prMap);
  useEffect(() => { prMapRef.current = prMap; }, [prMap]);
  // Mismo patrón para el progreso: toggleSet necesita saber si la serie estaba
  // marcada ANTES de decidir si arranca el temporizador, y esa decisión no puede
  // vivir dentro del updater (vibraría dos veces en StrictMode).
  const progressRef = useRef(progress);
  useEffect(() => { progressRef.current = progress; }, [progress]);
  const flashRef = useRef(new Map());
  useEffect(() => () => { flashRef.current.forEach(clearTimeout); flashRef.current.clear(); }, []);

  const checkPR = useCallback((exId, kg) => {
    if (kg == null || isNaN(kg) || kg <= 0) return;
    const cur = prMapRef.current[exId];
    if (cur && kg <= cur.kg) return;
    prMapRef.current = { ...prMapRef.current, [exId]: { kg, flash: true } };
    setPrMap(prev => ({ ...prev, [exId]: { kg, flash: true } }));
    vibrate(400);
    clearTimeout(flashRef.current.get(exId));
    flashRef.current.set(exId, setTimeout(() => {
      flashRef.current.delete(exId);
      setPrMap(p => (p[exId] ? { ...p, [exId]: { ...p[exId], flash: false } } : p));
    }, 4000));
  }, []);

  // ─── Mutaciones sobre el día activo ───
  const toggleSet = useCallback((exId, i, setCount, ex) => {
    fijarPorRegistro(diaActivo);
    // ¿Se está MARCANDO (no desmarcando)? Se decide fuera del updater, contra el
    // ref, para que el efecto (arrancar el temporizador) no se ejecute dos veces.
    const marcando = !progressRef.current[activeFecha]?.[exId]?.sets?.[i];
    setProgress(prev => {
      const day = prev[activeFecha] || {};
      const p = day[exId] || { sets: [], logs: [], lastre: null };
      const sets = [...(p.sets || [])];
      const logs = [...(p.logs || [])];
      while (sets.length < setCount) sets.push(false);
      while (logs.length < setCount) logs.push(null);
      sets[i] = !sets[i];
      return { ...prev, [activeFecha]: { ...day, [exId]: { ...p, sets, logs } } };
    });
    // Cada serie marcada reinicia el descanso con el del ejercicio recién marcado.
    if (marcando && ex) { const r = parseRest(ex.descanso); if (r) startTimer(r, ex.nombre); }
  }, [activeFecha, startTimer, fijarPorRegistro, diaActivo]);

  const onLog = useCallback((exId, i, log, setCount) => {
    fijarPorRegistro(diaActivo);
    setProgress(prev => {
      const day = prev[activeFecha] || {};
      const p = day[exId] || { sets: [], logs: [], lastre: null };
      const logs = [...(p.logs || [])];
      while (logs.length < setCount) logs.push(null);
      logs[i] = log;
      return { ...prev, [activeFecha]: { ...day, [exId]: { ...p, logs } } };
    });
    if (log?.kg != null) checkPR(exId, log.kg);
  }, [activeFecha, checkPR, fijarPorRegistro, diaActivo]);

  const onLastre = useCallback((exId, kg) => {
    fijarPorRegistro(diaActivo);
    setProgress(prev => {
      const day = prev[activeFecha] || {};
      const p = day[exId] || { sets: [], logs: [], lastre: null };
      return { ...prev, [activeFecha]: { ...day, [exId]: { ...p, lastre: kg } } };
    });
    if (kg != null) checkPR(exId, kg);
  }, [activeFecha, checkPR, fijarPorRegistro, diaActivo]);

  // Rellena la carga sugerida en las series que aún no tienen kg anotados.
  // Nunca sobrescribe lo que ya registraste: la sugerencia sigue siendo editable.
  const usarSugerido = useCallback((exId, kg, setCount) => {
    fijarPorRegistro(diaActivo);
    setProgress(prev => {
      const day = prev[activeFecha] || {};
      const p = day[exId] || { sets: [], logs: [], lastre: null };
      const logs = [...(p.logs || [])];
      while (logs.length < setCount) logs.push(null);
      for (let i = 0; i < setCount; i++) {
        if (logs[i]?.kg == null) logs[i] = { ...(logs[i] ?? {}), kg };
      }
      return { ...prev, [activeFecha]: { ...day, [exId]: { ...p, logs } } };
    });
    checkPR(exId, kg);
  }, [activeFecha, checkPR, fijarPorRegistro, diaActivo]);

  const onBanda = useCallback((exId, val) => {
    fijarPorRegistro(diaActivo);
    setProgress(prev => {
      const day = prev[activeFecha] || {};
      const p = day[exId] || { sets: [], logs: [], lastre: null };
      return { ...prev, [activeFecha]: { ...day, [exId]: { ...p, banda: val } } };
    });
  }, [activeFecha, fijarPorRegistro, diaActivo]);

  const resetDay = useCallback(() => {
    setProgress(prev => { const n = { ...prev }; delete n[activeFecha]; return n; });
  }, [activeFecha]);

  // ─── Sueño en posturno (regla S4) ───
  const onSueno = useCallback((h) => {
    setProgress(prev => ({ ...prev, [activeFecha]: { ...(prev[activeFecha] || {}), __sueno: h } }));
  }, [activeFecha]);

  // ─── Borrar el registro de un día cualquiera ───
  // Lo pide App al cambiar la sesión de un día con entrenamiento registrado
  // (tras confirmarlo): ese registro apuntaría a ejercicios que ya no existen.
  const borrarRegistro = useCallback((fecha) => {
    setProgress(prev => { const n = { ...prev }; delete n[fecha]; return n; });
  }, []);

  // ─── Avisos de reset (regla P6) ───
  const avisosReset = useMemo(() => calcularAvisosReset(progress, SESIONES), [progress]);

  return {
    progress, prMap, avisosReset,
    setProgress, setPrMap,   // los usa importar
    toggleSet, onLog, onLastre, usarSugerido, onBanda, resetDay, onSueno, borrarRegistro,
  };
}
