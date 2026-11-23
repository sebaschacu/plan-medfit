import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { CLAVE_CAMBIOS } from '../alternativas.js';
import { SESIONES, E11 } from '../data.js';
import { SESIONES_V6 } from '../planV6.js';
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

  // ─── «Hecha»: marcar la serie Y anotar su carga en un solo toque ───
  // Es toggleSet + onLog en una única actualización. `log` es lo que la tarjeta
  // propone (carga sugerida, reps de la serie anterior); con `log` nulo solo
  // marca. Sirve también para corregir una serie ya hecha: no la desmarca nunca.
  const registrarSerie = useCallback((exId, i, setCount, ex, log) => {
    fijarPorRegistro(diaActivo);
    const yaEstaba = !!progressRef.current[activeFecha]?.[exId]?.sets?.[i];
    setProgress(prev => {
      const day = prev[activeFecha] || {};
      const p = day[exId] || { sets: [], logs: [], lastre: null };
      const sets = [...(p.sets || [])];
      const logs = [...(p.logs || [])];
      while (sets.length < setCount) sets.push(false);
      while (logs.length < setCount) logs.push(null);
      sets[i] = true;
      if (log) logs[i] = log;
      return { ...prev, [activeFecha]: { ...day, [exId]: { ...p, sets, logs } } };
    });
    if (log?.kg != null) checkPR(exId, log.kg);
    if (!yaEstaba && ex) { const r = parseRest(ex.descanso); if (r) startTimer(r, ex.nombre); }
  }, [activeFecha, startTimer, checkPR, fijarPorRegistro, diaActivo]);

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

  // ─── E11 · deshacer una bi-serie solo por hoy ───
  // Se guarda en el día, bajo `__bsSueltas`, como lista de bi-series. Como el
  // sueño, no fija el día ni cuenta como ejercicio registrado: es una nota de
  // cómo se hizo la sesión, no un registro de carga.
  const toggleBiserieSuelta = useCallback((bs) => {
    setProgress(prev => {
      const day = prev[activeFecha] || {};
      const actuales = Array.isArray(day[E11.clave]) ? day[E11.clave] : [];
      const nuevas = actuales.includes(bs) ? actuales.filter(x => x !== bs) : [...actuales, bs];
      const nd = { ...day };
      if (nuevas.length) nd[E11.clave] = nuevas; else delete nd[E11.clave];   // sin basura si se deshace
      return { ...prev, [activeFecha]: nd };
    });
  }, [activeFecha]);

  // ─── Cambiar un ejercicio por una alternativa, solo hoy ───
  // Como E11: una nota del día en `__cambios` ({ idEnLaRutina: nombre }), que no
  // fija el día ni cuenta como registro. `null` vuelve al de la rutina.
  const cambiarHoy = useCallback((exId, nombre) => {
    setProgress(prev => {
      const day = prev[activeFecha] || {};
      const cambios = { ...(day[CLAVE_CAMBIOS] ?? {}) };
      if (nombre) cambios[exId] = nombre; else delete cambios[exId];
      const nd = { ...day };
      if (Object.keys(cambios).length) nd[CLAVE_CAMBIOS] = cambios; else delete nd[CLAVE_CAMBIOS];
      const n = { ...prev };
      if (Object.keys(nd).length) n[activeFecha] = nd; else delete n[activeFecha];
      return n;
    });
  }, [activeFecha]);

  // ─── Borrar el registro de un día cualquiera ───
  // Lo pide App al cambiar la sesión de un día con entrenamiento registrado
  // (tras confirmarlo): ese registro apuntaría a ejercicios que ya no existen.
  const borrarRegistro = useCallback((fecha) => {
    setProgress(prev => { const n = { ...prev }; delete n[fecha]; return n; });
  }, []);

  // ─── Avisos de reset (regla P6) ───
  const avisosReset = useMemo(() => calcularAvisosReset(progress, [...Object.values(SESIONES_V6), ...Object.values(SESIONES)]), [progress]);

  return {
    progress, prMap, avisosReset,
    setProgress, setPrMap,   // los usa importar
    toggleSet, registrarSerie, onLog, onLastre, usarSugerido, onBanda, resetDay, onSueno, toggleBiserieSuelta, cambiarHoy, borrarRegistro,
  };
}
