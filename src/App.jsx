import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { resolverRutina, estaEditada, huerfanosDelDia } from './rutina.js';
import { hoyISO } from './utiles/formato.js';
import { guardar, descargarJSON, leerRespaldo } from './estado/persistencia.js';
import { useTemporizador } from './estado/useTemporizador.js';
import { useNavegacion } from './estado/useNavegacion.js';
import { usePlan } from './estado/usePlan.js';
import { useRutinas } from './estado/useRutinas.js';
import { useProgreso } from './estado/useProgreso.js';
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

  const {
    ancla, fijados, festivos, extras, css,
    calendario, avisos, mesInfo, hayMesAnterior,
    setAncla, setFijados, setFestivos, setExtras, setCss,
    fijarPorRegistro, saveEdit: saveEditPlan, liberarDia: liberarDiaPlan,
    onSecundaria, onComplemento, fijarVariante: fijarVariantePlan, soltarVariante,
    onFlexible, onConvertirFlexible,
  } = usePlan({ anio, mes });

  const {
    rutina, setRutina,
    guardarRutina: guardarRutinaBase, restaurarRutina: restaurarRutinaBase,
  } = useRutinas({ todayISO });

  // Se calcula aquí arriba porque las mutaciones de progreso lo necesitan para
  // fijar el día automáticamente al registrar la primera serie.
  const diaActivo = useMemo(() => calendario.find(d => d.fecha === activeFecha), [calendario, activeFecha]);

  const {
    progress, prMap, avisosReset, setProgress, setPrMap,
    toggleSet, onLog, onLastre, usarSugerido, onBanda, resetDay, onSueno, borrarRegistro,
  } = useProgreso({ activeFecha, diaActivo, fijarPorRegistro, timerRef, startTimer });

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

  // ─── Orquestación plan ↔ progreso ───
  // Cambiar la sesión de un día con entrenamiento registrado deja ese registro
  // apuntando a ejercicios que ya no existen ahí: se borra (tras confirmarlo)
  // y luego se aplica el cambio. Ninguno de los dos hooks sabe del otro; lo
  // compone App, que tiene ambos. Cerrar el modal también es cosa de aquí.
  const saveEdit = useCallback((fecha, turno, sesion, festivo, conRegistro) => {
    if (conRegistro) borrarRegistro(fecha);
    saveEditPlan(fecha, turno, sesion, festivo);
    setEditingDay(null);
  }, [borrarRegistro, saveEditPlan]);
  const liberarDia = useCallback((fecha) => { liberarDiaPlan(fecha); setEditingDay(null); }, [liberarDiaPlan]);
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
  }, [avisar, setAncla, setFijados, setFestivos, setExtras, setCss, setRutina, setProgress, setPrMap]);

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
