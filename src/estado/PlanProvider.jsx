import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { ejerciciosDelDia } from '../rutina.js';
import { hoyISO } from '../utiles/formato.js';
import { guardar, descargarJSON, leerRespaldo } from './persistencia.js';
import { configVacia } from '../config.js';
import { claveReal, clavePrincipal } from '../data.js';
import { ContextoPlan, ContextoProgreso, ContextoAcciones } from './contextos.js';
import { useTemporizador } from './useTemporizador.js';
import { useNavegacion } from './useNavegacion.js';
import { usePlan } from './usePlan.js';
import { useRutinas } from './useRutinas.js';
import { useProgreso } from './useProgreso.js';

// ═══════════════ PROVIDER ═══════════════
// Los tres contextos y por qué son tres: ver contextos.js.
// Compone los seis hooks de estado, la persistencia y la orquestación entre
// plan y progreso. App queda como enrutador puro.
export function PlanProvider({ children }) {
  const todayISO = hoyISO();

  const { restTimer, startTimer, skipTimer } = useTemporizador();
  const {
    view, activeFecha, activeSesion, anio, mes,
    cambiarMes, openDay, abrirSesionDelDia, backToCalendar, irA,
  } = useNavegacion({ todayISO, skipTimer });

  const {
    ancla, fijados, festivos, extras, css, umbralRun, config, planCfg,
    calendario, avisos, mesInfo, hayMesAnterior,
    setAncla, setFijados, setFestivos, setExtras, setCss, setUmbralRun, setConfig,
    fijarPorRegistro, saveEdit: saveEditPlan, liberarDia,
    onSecundaria, onComplemento, fijarVariante: fijarVariantePlan, soltarVariante,
    onFlexible, onConvertirFlexible,
  } = usePlan({ anio, mes });

  const { rutina, setRutina, guardarRutina, restaurarRutina } = useRutinas({ todayISO });

  // Se calcula aquí arriba porque las mutaciones de progreso lo necesitan para
  // fijar el día automáticamente al registrar la primera serie.
  const diaActivo = useMemo(() => calendario.find(d => d.fecha === activeFecha), [calendario, activeFecha]);

  const {
    progress, prMap, avisosReset, setProgress, setPrMap,
    toggleSet, registrarSerie, onLog, onLastre, usarSugerido, onBanda, resetDay, onSueno, toggleBiserieSuelta, cambiarHoy, borrarRegistro,
  } = useProgreso({ activeFecha, diaActivo, fijarPorRegistro, startTimer });

  // ─── Persistencia robusta ───
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved
  const saveTimeoutRef = useRef(null);

  // Estado serializable: se guardan las ENTRADAS del generador, no su salida.
  // `config` solo se guarda si el usuario cambió algo en Ajustes, y `umbralRun`
  // solo cuando hay test de running: quien no los toca guarda exactamente lo
  // mismo que antes (lo vigila test-snapshot.mjs).
  const snapshot = useCallback(
    () => ({ v: 3, ancla, fijados, festivos, extras, css, rutina, prog: progress, prs: prMap,
      ...(configVacia(config) ? {} : { config }),
      ...(umbralRun == null ? {} : { umbralRun }) }),
    [ancla, fijados, festivos, extras, css, rutina, progress, prMap, config, umbralRun]
  );

  const doSave = useCallback((datos) => {
    if (guardar(datos)) {
      setSaveStatus('saved');
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => setSaveStatus('idle'), 1500);
      return true;
    }
    // Cuota llena o almacenamiento bloqueado (modo privado)
    setSaveStatus('error');
    return false;
  }, []);

  // Guardar cada vez que cambian los datos. Ya no hace falta esperar a "la carga":
  // el estado nace leído de localStorage, así que el primer guardado normaliza
  // directamente a v3 cualquier respaldo antiguo que se haya migrado al arrancar.
  useEffect(() => { doSave(snapshot()); }, [snapshot, doSave]);

  // Guardar también cuando la app se minimiza o se cierra (red de seguridad)
  useEffect(() => {
    const flush = () => { guardar(snapshot()); };   // si falla (cuota, privado) no hay nada que hacer aquí
    window.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
    };
  }, [snapshot]);

  // ─── Orquestación plan ↔ progreso ───
  // Cambiar la sesión de un día con entrenamiento registrado deja ese registro
  // apuntando a ejercicios que ya no existen ahí: se borra (tras confirmarlo)
  // y luego se aplica el cambio. Ninguno de los dos hooks sabe del otro.
  const saveEdit = useCallback((fecha, turno, sesion, festivo, conRegistro) => {
    if (conRegistro) borrarRegistro(fecha);
    saveEditPlan(fecha, turno, sesion, festivo);
  }, [borrarRegistro, saveEditPlan]);
  const fijarVariante = useCallback((fecha, clave, secundaria, conRegistro) => {
    if (conRegistro) borrarRegistro(fecha);
    fijarVariantePlan(fecha, clave, secundaria);
  }, [borrarRegistro, fijarVariantePlan]);

  // ─── Exportar / importar JSON ───
  const [mensajeDatos, setMensajeDatos] = useState(null);
  const avisar = useCallback((ok, texto) => {
    setMensajeDatos({ ok, texto });
    setTimeout(() => setMensajeDatos(null), 5000);
  }, []);

  // snapshot cambia con cada dato; si onExportar dependiera de él, cambiaría
  // de identidad en cada serie marcada y arrastraría a ContextoAcciones entero.
  // Se lee por ref: en el momento del click siempre está el snapshot vigente.
  const snapshotRef = useRef(snapshot);
  useEffect(() => { snapshotRef.current = snapshot; }, [snapshot]);
  const onExportar = useCallback(() => {
    try {
      descargarJSON(snapshotRef.current(), `plan-internado-${todayISO}.json`);
      avisar(true, 'Exportado. Pásalo al otro dispositivo e impórtalo allí.');
    } catch {
      avisar(false, 'No se pudo exportar en este navegador.');
    }
  }, [todayISO, avisar]);

  const onImportar = useCallback((file) => {
    leerRespaldo(file).then(r => {
      if (!r.ok) { avisar(false, r.error); return; }
      const d = r.datos;
      if (d.ancla) setAncla(d.ancla);
      setFijados(d.fijados);
      setFestivos(d.festivos);
      setExtras(d.extras);
      setCss(d.css);
      setUmbralRun(d.umbralRun);
      setRutina(d.rutina);
      setProgress(d.prog);
      setPrMap(d.prs);
      setConfig(d.config);
      const nDias = Object.keys(d.prog).length;
      const nRut = Object.keys(d.rutina).length;
      avisar(true, `Importado: ${nDias} ${nDias === 1 ? 'día' : 'días'} con registro`
        + (nRut ? `, ${nRut} ${nRut === 1 ? 'rutina editada' : 'rutinas editadas'}` : '')
        + (d.css != null ? ', CSS incluido' : '')
        + (d.umbralRun != null ? ', ritmo de running incluido' : '')
        + (configVacia(d.config) ? '' : ', con tus ajustes del plan') + '.');
    });
  // Los setters son de useState (identidad estable): van en la lista solo para
  // el linter, que al venir de hooks propios ya no sabe que lo son.
  }, [avisar, setAncla, setFijados, setFestivos, setExtras, setCss, setUmbralRun, setRutina, setProgress, setPrMap, setConfig]);

  // ─── Derivados de la vista ───
  // Clave real de la sesión que se está viendo (natación y running resuelven a su variante)
  const claveVista = useMemo(() => diaActivo && (activeSesion
    ? claveReal(activeSesion, diaActivo.varianteSecundaria)
    : clavePrincipal(diaActivo)),
  [diaActivo, activeSesion]);
  const ejerciciosVigentes = useMemo(
    () => claveVista ? ejerciciosDelDia(claveVista, activeFecha, rutina, progress[activeFecha]) : null,
    [claveVista, activeFecha, rutina, progress]
  );

  // ─── Los tres valores ───
  // Cada uno es un useMemo sobre sus propias piezas: el objeto solo cambia de
  // identidad cuando cambia algo de dentro, y solo entonces se re-renderizan
  // sus consumidores.
  const valorPlan = useMemo(() => ({
    todayISO, ancla, fijados, festivos, extras, css, umbralRun, rutina, config, planCfg,
    calendario, avisos, mesInfo, hayMesAnterior,
    view, activeFecha, activeSesion, anio, mes,
    diaActivo, claveVista, ejerciciosVigentes,
  }), [todayISO, ancla, fijados, festivos, extras, css, umbralRun, rutina, config, planCfg,
    calendario, avisos, mesInfo, hayMesAnterior,
    view, activeFecha, activeSesion, anio, mes,
    diaActivo, claveVista, ejerciciosVigentes]);

  const valorProgreso = useMemo(() => ({
    progress, prMap, avisosReset, restTimer, saveStatus, mensajeDatos,
  }), [progress, prMap, avisosReset, restTimer, saveStatus, mensajeDatos]);

  const valorAcciones = useMemo(() => ({
    // navegación
    cambiarMes, openDay, abrirSesionDelDia, backToCalendar, irA,
    // plan
    saveEdit, liberarDia, onSecundaria, onComplemento, fijarVariante, soltarVariante,
    onFlexible, onConvertirFlexible, setCss, setUmbralRun, setConfig,
    // rutinas
    guardarRutina, restaurarRutina,
    // progreso
    toggleSet, registrarSerie, onLog, onLastre, usarSugerido, onBanda, resetDay, onSueno, toggleBiserieSuelta, cambiarHoy,
    // temporizador
    skipTimer,
    // datos
    onExportar, onImportar,
  }), [cambiarMes, openDay, abrirSesionDelDia, backToCalendar, irA,
    saveEdit, liberarDia, onSecundaria, onComplemento, fijarVariante, soltarVariante,
    onFlexible, onConvertirFlexible, setCss, setUmbralRun, setConfig,
    guardarRutina, restaurarRutina,
    toggleSet, registrarSerie, onLog, onLastre, usarSugerido, onBanda, resetDay, onSueno, toggleBiserieSuelta, cambiarHoy,
    skipTimer, onExportar, onImportar]);

  return (
    <ContextoPlan.Provider value={valorPlan}>
      <ContextoProgreso.Provider value={valorProgreso}>
        <ContextoAcciones.Provider value={valorAcciones}>
          {children}
        </ContextoAcciones.Provider>
      </ContextoProgreso.Provider>
    </ContextoPlan.Provider>
  );
}
