import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { SESIONES } from './data.js';
import { calcularAvisosReset } from './reglas.js';
import { resolverRutina, estaEditada, huerfanosDelDia } from './rutina.js';
import { parseRest, hoyISO } from './utiles/formato.js';
import { vibrate } from './utiles/sonido.js';
import { estadoGuardado, guardar, descargarJSON, leerRespaldo } from './estado/persistencia.js';
import { useTemporizador } from './estado/useTemporizador.js';
import { useNavegacion } from './estado/useNavegacion.js';
import { usePlan } from './estado/usePlan.js';
import { useRutinas } from './estado/useRutinas.js';
import FichaSesion from './componentes/biblioteca/FichaSesion.jsx';
import Biblioteca from './componentes/biblioteca/Biblioteca.jsx';
import EditorRutina from './componentes/biblioteca/EditorRutina.jsx';
import CalendarView from './componentes/calendario/CalendarView.jsx';
import EditModal from './componentes/calendario/EditModal.jsx';
import SessionView from './componentes/sesion/SessionView.jsx';

// ═══════════════ MAIN APP ═══════════════
export default function App() {
  const todayISO = hoyISO();

  // ─── Flags de pantalla ───
  const [editandoRutina, setEditandoRutina] = useState(null);   // clave de sesión
  const [biblioteca, setBiblioteca] = useState(false);
  const [fichaSesion, setFichaSesion] = useState(null);         // clave de sesión a consultar

  const { restTimer, timerRef, startTimer, skipTimer } = useTemporizador();
  const {
    view, activeFecha, activeSesion, anio, mes,
    cambiarMes, openDay, abrirSesionDelDia, backToCalendar,
  } = useNavegacion({ todayISO, skipTimer });

  const [progress, setProgress] = useState(() => estadoGuardado().prog); // { 'YYYY-MM-DD': { exId: {sets,logs} } }
  const [prMap, setPrMap] = useState(() => estadoGuardado().prs);        // { exId: {kg, flash} }
  // Cambiar la sesión de un día con registro deja ese registro apuntando a
  // ejercicios que ya no existen ahí. El plan lo pide cuando toca borrarlo.
  const borrarRegistro = useCallback((fecha) => {
    setProgress(prev => { const n = { ...prev }; delete n[fecha]; return n; });
  }, []);

  const {
    ancla, fijados, festivos, extras, css,
    calendario, avisos, mesInfo, hayMesAnterior,
    setAncla, setFijados, setFestivos, setExtras, setCss,
    fijarPorRegistro, saveEdit: saveEditPlan, liberarDia: liberarDiaPlan,
    onSecundaria, onComplemento, fijarVariante, soltarVariante,
    onFlexible, onConvertirFlexible,
  } = usePlan({ anio, mes, borrarRegistro });

  const {
    rutina, setRutina,
    guardarRutina: guardarRutinaBase, restaurarRutina: restaurarRutinaBase,
  } = useRutinas({ todayISO });
  // Se calcula aquí arriba porque las mutaciones de progreso lo necesitan para
  // fijar el día automáticamente al registrar la primera serie.
  const diaActivo = useMemo(() => calendario.find(d => d.fecha === activeFecha), [calendario, activeFecha]);
  const [editMode, setEditMode] = useState(false);
  const [editingDay, setEditingDay] = useState(null);

  // ─── Persistencia robusta ───
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved
  const saveTimeoutRef = useRef(null);

  // Estado serializable: se guardan las ENTRADAS del generador, no su salida.
  const snapshot = useCallback(
    () => ({ v: 3, ancla, fijados, festivos, extras, css, rutina, prog: progress, prs: prMap }),
    [ancla, fijados, festivos, extras, css, rutina, progress, prMap]
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

  // ─── PR detector ───
  // El updater de setPrMap tiene que ser PURO. Antes llamaba a vibrate() y
  // programaba un setTimeout dentro: React invoca los updaters dos veces en
  // StrictMode, así que vibraba dos veces y dejaba dos temporizadores sueltos.
  // Es el mismo error que el de la navegación de mes. Ahora la comparación se
  // hace contra un ref y los efectos ocurren fuera del updater.
  const prMapRef = useRef(prMap);
  useEffect(() => { prMapRef.current = prMap; }, [prMap]);
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

  // ─── Mutaciones de progreso ───
  const toggleSet = useCallback((exId, i, setCount, ex) => {
    fijarPorRegistro(diaActivo);
    setProgress(prev => {
      const day = prev[activeFecha] || {};
      const p = day[exId] || { sets: [], logs: [], lastre: null };
      const sets = [...(p.sets || [])];
      const logs = [...(p.logs || [])];
      while (sets.length < setCount) sets.push(false);
      while (logs.length < setCount) logs.push(null);
      const nv = !sets[i];
      sets[i] = nv;
      if (nv && !timerRef.current && ex) { const r = parseRest(ex.descanso); if (r) startTimer(r, ex.nombre); }
      return { ...prev, [activeFecha]: { ...day, [exId]: { ...p, sets, logs } } };
    });
  // timerRef es un ref (identidad estable): va en la lista solo para el linter,
  // que al venir de un hook propio ya no sabe que lo es.
  }, [activeFecha, startTimer, fijarPorRegistro, diaActivo, timerRef]);

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

  // ─── Editar día ───
  // La mutación vive en usePlan; cerrar el modal es cosa del enrutador.
  const saveEdit = useCallback((...args) => { saveEditPlan(...args); setEditingDay(null); }, [saveEditPlan]);
  const liberarDia = useCallback((fecha) => { liberarDiaPlan(fecha); setEditingDay(null); }, [liberarDiaPlan]);

  // ─── Sueño en posturno (regla S4) ───
  const onSueno = useCallback((h) => {
    setProgress(prev => ({ ...prev, [activeFecha]: { ...(prev[activeFecha] || {}), __sueno: h } }));
  }, [activeFecha]);

  // ─── Avisos de reset (regla P6) ───
  const avisosReset = useMemo(() => calcularAvisosReset(progress, SESIONES), [progress]);

  // ─── Exportar / importar JSON ───
  const [mensajeDatos, setMensajeDatos] = useState(null);
  const avisar = useCallback((ok, texto) => {
    setMensajeDatos({ ok, texto });
    setTimeout(() => setMensajeDatos(null), 5000);
  }, []);

  const onExportar = useCallback(() => {
    try {
      descargarJSON(snapshot(), `plan-internado-${todayISO}.json`);
      avisar(true, 'Exportado. Pásalo al otro dispositivo e impórtalo allí.');
    } catch {
      avisar(false, 'No se pudo exportar en este navegador.');
    }
  }, [snapshot, todayISO, avisar]);

  const onImportar = useCallback((file) => {
    leerRespaldo(file).then(r => {
      if (!r.ok) { avisar(false, r.error); return; }
      const d = r.datos;
      if (d.ancla) setAncla(d.ancla);
      setFijados(d.fijados);
      setFestivos(d.festivos);
      setExtras(d.extras);
      setCss(d.css);
      setRutina(d.rutina);
      setProgress(d.prog);
      setPrMap(d.prs);
      const nDias = Object.keys(d.prog).length;
      const nRut = Object.keys(d.rutina).length;
      avisar(true, `Importado: ${nDias} ${nDias === 1 ? 'día' : 'días'} con registro`
        + (nRut ? `, ${nRut} ${nRut === 1 ? 'rutina editada' : 'rutinas editadas'}` : '')
        + (d.css != null ? ', CSS incluido' : '') + '.');
    });
  // Los setters son de useState (identidad estable): van en la lista solo para
  // el linter, que al venir de hooks propios ya no sabe que lo son.
  }, [avisar, setAncla, setFijados, setFestivos, setExtras, setCss, setRutina]);

  // ─── Editor de rutina ───
  // La mutación vive en useRutinas; cerrar el editor es cosa del enrutador.
  const guardarRutina = useCallback((...args) => { guardarRutinaBase(...args); setEditandoRutina(null); }, [guardarRutinaBase]);
  const restaurarRutina = useCallback((k) => { restaurarRutinaBase(k); setEditandoRutina(null); }, [restaurarRutinaBase]);

  const activeDiaData = diaActivo;

  // Clave real de la sesión que se está viendo (natación resuelve a su variante)
  const claveVista = activeDiaData && (activeSesion
    ? (activeSesion === 'natacion' ? (activeDiaData.varianteSecundaria ?? 'natacion') : activeSesion)
    : (activeDiaData.sesion === 'natacion' ? (activeDiaData.variante ?? 'natacion') : activeDiaData.sesion));
  const ejerciciosVigentes = claveVista ? resolverRutina(claveVista, activeFecha, rutina) : null;

  if (fichaSesion) {
    return (
      <FichaSesion sesionKey={fichaSesion}
        ejercicios={resolverRutina(fichaSesion, todayISO, rutina)}
        onCerrar={() => setFichaSesion(null)} />
    );
  }

  if (biblioteca) {
    return <Biblioteca onAbrir={setFichaSesion} onCerrar={() => setBiblioteca(false)} />;
  }

  if (editandoRutina) {
    return (
      <EditorRutina
        sesionKey={editandoRutina}
        ejercicios={resolverRutina(editandoRutina, todayISO, rutina)}
        editada={estaEditada(editandoRutina, todayISO, rutina)}
        onGuardar={(ejs, motivo) => guardarRutina(editandoRutina, ejs, motivo)}
        onRestaurar={() => restaurarRutina(editandoRutina)}
        onCerrar={() => setEditandoRutina(null)}
      />
    );
  }

  // Si por lo que sea no hay día activo (mes cambiado, fecha fuera de rango),
  // se cae al calendario en lugar de dejar la pantalla vacía.
  if (view === 'session' && !activeDiaData) {
    return (
      <>
        <CalendarView
          calendario={calendario} progress={progress} avisos={avisos}
          onOpenDay={openDay} onEditDay={setEditingDay}
          editMode={editMode} setEditMode={setEditMode} todayISO={todayISO}
          saveStatus={saveStatus} mesInfo={mesInfo} onMes={cambiarMes} hayMesAnterior={hayMesAnterior} rutina={rutina}
          onExportar={onExportar} onImportar={onImportar} mensajeDatos={mensajeDatos}
          onBiblioteca={() => setBiblioteca(true)} prMap={prMap}
        />
        {editingDay && (
          <EditModal
            dia={editingDay} onSave={saveEdit} onLiberar={liberarDia} onClose={() => setEditingDay(null)}
            ejerciciosRegistrados={Object.keys(progress[editingDay.fecha] || {}).filter(k => !k.startsWith('__')).length}
          />
        )}
      </>
    );
  }

  if (view === 'session' && activeDiaData) {
    return (
      <>
        <SessionView
          diaData={activeDiaData} sesionKey={claveVista}
          ejerciciosVigentes={ejerciciosVigentes}
          huerfanos={huerfanosDelDia(progress[activeFecha] ?? {}, ejerciciosVigentes ?? [])}
          onEditarRutina={setEditandoRutina}
          rutinaEditada={estaEditada(claveVista, todayISO, rutina)}
          esSecundaria={!!activeSesion}
          onSecundaria={onSecundaria} onComplemento={onComplemento} onAbrirSesion={abrirSesionDelDia}
          css={css} onCSS={setCss}
          onFlexible={onFlexible} onConvertirFlexible={onConvertirFlexible}
          onFijarVariante={fijarVariante} onSoltarVariante={soltarVariante}
          onVerFicha={setFichaSesion} progresoTotal={progress} onUsarSugerido={usarSugerido}
          progress={progress[activeFecha]} prMap={prMap}
          onBack={backToCalendar} onToggleSet={toggleSet} onLog={onLog} onLastre={onLastre} onBanda={onBanda}
          onReset={resetDay} restTimer={restTimer} onSkipTimer={skipTimer}
          avisosReset={avisosReset} onSueno={onSueno}
        />
      </>
    );
  }

  return (
    <>
      <CalendarView
        calendario={calendario} progress={progress} avisos={avisos}
        onOpenDay={openDay} onEditDay={setEditingDay}
        editMode={editMode} setEditMode={setEditMode} todayISO={todayISO}
        saveStatus={saveStatus} mesInfo={mesInfo} onMes={cambiarMes} hayMesAnterior={hayMesAnterior} rutina={rutina}
        onExportar={onExportar} onImportar={onImportar} mensajeDatos={mensajeDatos}
        onBiblioteca={() => setBiblioteca(true)} prMap={prMap}
      />
      {editingDay && (
        <EditModal
          dia={editingDay} onSave={saveEdit} onLiberar={liberarDia} onClose={() => setEditingDay(null)}
          ejerciciosRegistrados={Object.keys(progress[editingDay.fecha] || {}).filter(k => !k.startsWith('__')).length}
        />
      )}
    </>
  );
}
