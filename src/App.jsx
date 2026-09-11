import React, { useState, useCallback } from 'react';
import { resolverRutina, estaEditada, huerfanosDelDia } from './rutina.js';
import { contarRender } from './utiles/medir.js';
import { usePlanCtx, useProgresoCtx, useAccionesCtx } from './estado/contextos.js';
import FichaSesion from './componentes/biblioteca/FichaSesion.jsx';
import Biblioteca from './componentes/biblioteca/Biblioteca.jsx';
import EditorRutina from './componentes/biblioteca/EditorRutina.jsx';
import CalendarView from './componentes/calendario/CalendarView.jsx';
import EditModal from './componentes/calendario/EditModal.jsx';
import SessionView from './componentes/sesion/SessionView.jsx';

// ═══════════════ MAIN APP · el enrutador ═══════════════
// El estado vive en PlanProvider. Aquí solo queda qué pantalla se muestra y
// los flags locales de la interfaz (modales, biblioteca, editor).
export default function App() {
  contarRender('App');

  const {
    todayISO, css, rutina, calendario, avisos, mesInfo, hayMesAnterior,
    view, activeFecha, activeSesion, diaActivo, claveVista, ejerciciosVigentes,
  } = usePlanCtx();
  const { progress, prMap, avisosReset, restTimer, saveStatus, mensajeDatos } = useProgresoCtx();
  const {
    cambiarMes, openDay, abrirSesionDelDia, backToCalendar,
    saveEdit: saveEditBase, liberarDia: liberarDiaBase,
    onSecundaria, onComplemento, fijarVariante, soltarVariante,
    onFlexible, onConvertirFlexible, setCss,
    guardarRutina: guardarRutinaBase, restaurarRutina: restaurarRutinaBase,
    toggleSet, onLog, onLastre, usarSugerido, onBanda, resetDay, onSueno,
    skipTimer, onExportar, onImportar,
  } = useAccionesCtx();

  // ─── Flags de pantalla ───
  const [editandoRutina, setEditandoRutina] = useState(null);   // clave de sesión
  const [biblioteca, setBiblioteca] = useState(false);
  const [fichaSesion, setFichaSesion] = useState(null);         // clave de sesión a consultar
  const [editMode, setEditMode] = useState(false);
  const [editingDay, setEditingDay] = useState(null);

  // Las mutaciones viven en el Provider; cerrar el modal o el editor es cosa
  // del enrutador.
  const saveEdit = useCallback((...args) => { saveEditBase(...args); setEditingDay(null); }, [saveEditBase]);
  const liberarDia = useCallback((fecha) => { liberarDiaBase(fecha); setEditingDay(null); }, [liberarDiaBase]);
  const guardarRutina = useCallback((...args) => { guardarRutinaBase(...args); setEditandoRutina(null); }, [guardarRutinaBase]);
  const restaurarRutina = useCallback((k) => { restaurarRutinaBase(k); setEditandoRutina(null); }, [restaurarRutinaBase]);

  const activeDiaData = diaActivo;

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
