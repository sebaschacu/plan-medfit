import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { SESIONES } from './data.js';
import { generarMes, infoMes, ANCLA_DEFAULT, FESTIVOS_DEFAULT } from './generador.js';
import { calcularAvisosReset } from './reglas.js';
import {
  resolverRutina, estaEditada, guardarVersion, restaurarPlan, huerfanosDelDia,
} from './rutina.js';
import { parseRest, hoyISO } from './utiles/formato.js';
import { vibrate } from './utiles/sonido.js';
import { estadoGuardado, guardar, descargarJSON, leerRespaldo } from './estado/persistencia.js';
import { useTemporizador } from './estado/useTemporizador.js';
import { useNavegacion } from './estado/useNavegacion.js';
import FichaSesion from './componentes/biblioteca/FichaSesion.jsx';
import Biblioteca from './componentes/biblioteca/Biblioteca.jsx';
import EditorRutina from './componentes/biblioteca/EditorRutina.jsx';
import CalendarView from './componentes/calendario/CalendarView.jsx';
import EditModal from './componentes/calendario/EditModal.jsx';
import SessionView from './componentes/sesion/SessionView.jsx';

// ═══════════════ MAIN APP ═══════════════
export default function App() {
  const todayISO = hoyISO();

  // ─── Estado del generador v6 ───
  // El calendario ya NO es estado: es una función pura de (ancla, fijados, festivos).
  // Guardar el array generado sería duplicar la verdad y arriesgarse a que se
  // desincronice del ancla; lo que se persiste son las ENTRADAS.
  const [ancla, setAncla] = useState(() => estadoGuardado().ancla ?? ANCLA_DEFAULT);
  const [fijados, setFijados] = useState(() => estadoGuardado().fijados);   // { fecha: { turno, sesion, auto? } }
  const [festivos, setFestivos] = useState(() => estadoGuardado().festivos ?? FESTIVOS_DEFAULT);
  // Lo que el usuario añade sobre el día generado: segunda sesión y complementos.
  // Va aparte de `fijados` porque no cambia la sesión principal ni la cola de gym.
  const [extras, setExtras] = useState(() => estadoGuardado().extras ?? {});
  const [css, setCss] = useState(() => estadoGuardado().css ?? null);   // segundos por 100 m
  // Versiones de rutina encima del plan base. El pasado no se reescribe.
  const [rutina, setRutina] = useState(() => estadoGuardado().rutina ?? {});
  const [editandoRutina, setEditandoRutina] = useState(null);   // clave de sesión
  const [biblioteca, setBiblioteca] = useState(false);
  const [fichaSesion, setFichaSesion] = useState(null);         // clave de sesión a consultar

  const { restTimer, timerRef, startTimer, skipTimer } = useTemporizador();
  const {
    view, activeFecha, activeSesion, anio, mes,
    hayMesAnterior, cambiarMes, openDay, abrirSesionDelDia, backToCalendar,
  } = useNavegacion({ todayISO, ancla, skipTimer });

  const { dias: generado, avisos } = useMemo(
    () => generarMes({ anio, mes, ancla, fijados, festivos }),
    [anio, mes, ancla, fijados, festivos]
  );
  // Se fusiona lo que añadió el usuario sobre lo que produjo el generador.
  const calendario = useMemo(() => generado.map(d => {
    const ex = extras[d.fecha];
    if (!ex) return d;
    return {
      ...d,
      sesionSecundaria: ex.secundaria ?? d.sesionSecundaria,
      secundariaManual: !!ex.secundaria,
      separacionH: ex.separacionH,
      complementos: ex.complementos ?? [],
      flexRespuesta: ex.flex,
    };
  }), [generado, extras]);
  const mesInfo = useMemo(() => infoMes(anio, mes), [anio, mes]);

  const [progress, setProgress] = useState(() => estadoGuardado().prog); // { 'YYYY-MM-DD': { exId: {sets,logs} } }
  const [prMap, setPrMap] = useState(() => estadoGuardado().prs);        // { exId: {kg, flash} }
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
  // En cuanto se registra algo en un día, ese día queda FIJADO automáticamente.
  // Sin esto, editar otro día recalcularía el calendario y podría cambiarle la
  // sesión, dejando el registro con IDs de ejercicios que ya no existen ahí.
  // Fijarlo a su valor actual no altera nada más: la cola de gym se resincroniza
  // a la misma posición en la que ya estaba.
  const fijarPorRegistro = useCallback((dia) => {
    if (!dia) return;
    setFijados(prev => prev[dia.fecha]
      ? prev
      : {
          ...prev,
          [dia.fecha]: {
            turno: dia.turno,
            sesion: dia.sesion,
            // La VARIANTE también se fija: la natación es un tipo que resuelve a
            // natA1, natB1… Si solo se guardara el tipo, un cambio en la rotación
            // podría darle otra variante a un día ya entrenado y dejar su registro
            // (B1-3, B2-2…) apuntando a ejercicios que no están en la nueva.
            ...(dia.variante ? { variante: dia.variante } : {}),
            auto: true,
          },
        });
  }, []);

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

  // ─── Editar día: FIJAR + recalcular lo que viene ───
  // El calendario se regenera solo, porque es un useMemo sobre `fijados`.
  const saveEdit = useCallback((fecha, turno, sesion, festivo, borrarRegistro) => {
    // Al cambiar de sesión un día con registro, ese registro apunta a ejercicios
    // que ya no existen ahí: se borra (solo tras confirmarlo en el modal).
    if (borrarRegistro) setProgress(prev => { const n = { ...prev }; delete n[fecha]; return n; });
    setFijados(prev => ({ ...prev, [fecha]: { turno, sesion } }));
    setFestivos(prev => festivo
      ? (prev.includes(fecha) ? prev : [...prev, fecha])
      : prev.filter(f => f !== fecha));
    setEditingDay(null);
  }, []);

  // Soltar un día fijado: vuelve a mandar el generador
  const liberarDia = useCallback((fecha) => {
    setFijados(prev => { const n = { ...prev }; delete n[fecha]; return n; });
    setEditingDay(null);
  }, []);

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
  }, [avisar]);

  // ─── Segunda sesión y complementos ───
  const setExtra = useCallback((fecha, cambio) => {
    setExtras(prev => {
      const actual = prev[fecha] ?? {};
      const nuevo = { ...actual, ...cambio };
      // Si queda vacío se elimina la entrada, para no guardar basura
      const vacio = !nuevo.secundaria && !(nuevo.complementos?.length) && nuevo.separacionH == null && !nuevo.flex;
      const out = { ...prev };
      if (vacio) delete out[fecha]; else out[fecha] = nuevo;
      return out;
    });
  }, []);

  const onSecundaria = useCallback((fecha, sesion, separacionH) =>
    setExtra(fecha, { secundaria: sesion || undefined, separacionH }), [setExtra]);

  const onComplemento = useCallback((fecha, comp, activo) => {
    setExtras(prev => {
      const actual = prev[fecha] ?? {};
      const lista = new Set(actual.complementos ?? []);
      if (activo) lista.add(comp); else lista.delete(comp);
      const nuevo = { ...actual, complementos: [...lista] };
      const vacio = !nuevo.secundaria && !nuevo.complementos.length && nuevo.separacionH == null && !nuevo.flex;
      const out = { ...prev };
      if (vacio) delete out[fecha]; else out[fecha] = nuevo;
      return out;
    });
  }, []);

  // ─── Editor de rutina ───
  const guardarRutina = useCallback((sesionKey, ejercicios, motivo) => {
    setRutina(prev => guardarVersion(prev, sesionKey, ejercicios, todayISO, motivo));
    setEditandoRutina(null);
  }, [todayISO]);
  const restaurarRutina = useCallback((sesionKey) => {
    setRutina(prev => restaurarPlan(prev, sesionKey, todayISO));
    setEditandoRutina(null);
  }, [todayISO]);

  // ─── Variante de la sesión (cuál de la cola toca hoy) ───
  const fijarVariante = useCallback((fecha, clave, secundaria, borrarRegistro) => {
    const dia = calendario.find(d => d.fecha === fecha);
    if (!dia) return;
    if (borrarRegistro) setProgress(prev => { const n = { ...prev }; delete n[fecha]; return n; });
    setFijados(prev => {
      const act = prev[fecha] ?? { turno: dia.turno, sesion: dia.sesion };
      // Natación: el TIPO no cambia, cambia la variante. Gym: cambia la sesión.
      const esNat = (secundaria ? dia.sesionSecundaria : dia.sesion) === 'natacion';
      if (esNat) {
        return { ...prev, [fecha]: { ...act, turno: dia.turno, sesion: dia.sesion,
          [secundaria ? 'varianteSecundaria' : 'variante']: clave } };
      }
      return { ...prev, [fecha]: { ...act, turno: dia.turno, sesion: clave } };
    });
  }, [calendario]);

  const soltarVariante = useCallback((fecha, secundaria) => {
    setFijados(prev => {
      const act = prev[fecha];
      if (!act) return prev;
      const resto = { ...act };
      delete resto[secundaria ? 'varianteSecundaria' : 'variante'];
      const quedaAlguna = !!(resto.variante || resto.varianteSecundaria);
      const out = { ...prev };
      if (quedaAlguna) { out[fecha] = resto; return out; }
      // Ya no queda ninguna variante elegida a mano:
      //  · si el día tiene registro, se conserva el auto-fijado (protege el historial)
      //  · si no, se suelta del todo para que vuelva a mandar la rotación
      if (act.auto) out[fecha] = { turno: act.turno, sesion: act.sesion, auto: true };
      else delete out[fecha];
      return out;
    });
  }, []);

  // ─── Día flexible ───
  const onFlexible = useCallback((fecha, cambio) => {
    setExtras(prev => ({ ...prev, [fecha]: { ...(prev[fecha] ?? {}), flex: { ...(prev[fecha]?.flex ?? {}), ...cambio } } }));
  }, []);
  // Convertirlo en running es fijar ese día: el generador lo respetará al recalcular
  const onConvertirFlexible = useCallback((fecha, sesion) => {
    setFijados(prev => ({ ...prev, [fecha]: { ...(prev[fecha] ?? {}), turno: 'C', sesion } }));
  }, []);

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
