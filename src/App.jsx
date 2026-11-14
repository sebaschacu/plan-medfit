import React, { useState, useCallback } from 'react';
import { contarRender } from './utiles/medir.js';
import { usePlanCtx, useAccionesCtx } from './estado/contextos.js';
import FichaSesion from './componentes/biblioteca/FichaSesion.jsx';
import Biblioteca from './componentes/biblioteca/Biblioteca.jsx';
import EditorRutina from './componentes/biblioteca/EditorRutina.jsx';
import CalendarView from './componentes/calendario/CalendarView.jsx';
import EditModal from './componentes/calendario/EditModal.jsx';
import SessionView from './componentes/sesion/SessionView.jsx';
import DiaView from './componentes/sesion/DiaView.jsx';
import ProgresoView from './componentes/estadisticas/ProgresoView.jsx';
import AjustesView from './componentes/ajustes/AjustesView.jsx';
import BarraInferior from './componentes/comunes/BarraInferior.jsx';

// ═══════════════ MAIN APP · el enrutador ═══════════════
// El estado vive en PlanProvider. Aquí solo queda qué pantalla se muestra y
// los flags locales de la interfaz (modales, ficha, editor).
//
// Cuatro pestañas abajo —Hoy, Calendario, Progreso, Rutinas— y, encima de
// ellas, lo que se abre desde una: el día de otra fecha, la sesión, la ficha
// de una rutina, su editor y los ajustes.
export default function App() {
  contarRender('App');

  // App NO lee ContextoProgreso a propósito: así marcar una serie no lo
  // re-renderiza. Del plan solo necesita lo justo para enrutar.
  const { view, diaActivo, activeFecha, todayISO } = usePlanCtx();
  const {
    saveEdit: saveEditBase, liberarDia: liberarDiaBase,
    guardarRutina: guardarRutinaBase, restaurarRutina: restaurarRutinaBase, irA,
  } = useAccionesCtx();

  // ─── Flags de pantalla ───
  const [editandoRutina, setEditandoRutina] = useState(null);   // clave de sesión
  const [fichaSesion, setFichaSesion] = useState(null);         // clave de sesión a consultar
  const [editMode, setEditMode] = useState(false);
  const [editingDay, setEditingDay] = useState(null);
  const [seccionAjustes, setSeccionAjustes] = useState(null);   // qué pantalla de Ajustes está abierta

  // Las mutaciones viven en el Provider; cerrar el modal o el editor es cosa
  // del enrutador.
  const saveEdit = useCallback((...args) => { saveEditBase(...args); setEditingDay(null); }, [saveEditBase]);
  const liberarDia = useCallback((fecha) => { liberarDiaBase(fecha); setEditingDay(null); }, [liberarDiaBase]);
  const guardarRutina = useCallback((...args) => { guardarRutinaBase(...args); setEditandoRutina(null); }, [guardarRutinaBase]);
  const restaurarRutina = useCallback((k) => { restaurarRutinaBase(k); setEditandoRutina(null); }, [restaurarRutinaBase]);

  // Cambiar de pestaña cierra lo que hubiera abierto encima.
  const [vistaPrevia, setVistaPrevia] = useState(view);
  // Salir de Ajustes la deja en su menú principal para la próxima vez.
  if (vistaPrevia !== view) {
    if (vistaPrevia === 'ajustes') setSeccionAjustes(null);
    setVistaPrevia(view); setFichaSesion(null); setEditandoRutina(null);
  }

  if (editandoRutina) {
    return (
      <EditorRutina
        sesionKey={editandoRutina}
        onGuardar={(ejs, motivo) => guardarRutina(editandoRutina, ejs, motivo)}
        onRestaurar={() => restaurarRutina(editandoRutina)}
        onCerrar={() => setEditandoRutina(null)}
      />
    );
  }

  // Qué pestaña se marca abajo.
  const pestana = view === 'dia' || view === 'session'
    ? (activeFecha === todayISO ? 'hoy' : 'calendar')
    : view === 'ajustes' ? null : view;

  let pantalla;
  if (fichaSesion) {
    pantalla = <FichaSesion sesionKey={fichaSesion} onCerrar={() => setFichaSesion(null)} onEditar={setEditandoRutina} />;
  } else if (view === 'session' && diaActivo) {
    // La sesión se usa de pie en el gimnasio: sin barra inferior, toda la
    // pantalla para el ejercicio y el temporizador.
    return <SessionView onEditarRutina={setEditandoRutina} onVerFicha={setFichaSesion} />;
  } else if (view === 'dia' && diaActivo) {
    pantalla = <DiaView onVerFicha={setFichaSesion} />;
  } else if (view === 'progreso') {
    pantalla = <ProgresoView />;
  } else if (view === 'rutinas') {
    pantalla = <Biblioteca onAbrir={setFichaSesion} onNuevoDeporte={() => { setSeccionAjustes('deporte:nuevo'); irA('ajustes'); }} />;
  } else if (view === 'ajustes') {
    pantalla = <AjustesView seccion={seccionAjustes} setSeccion={setSeccionAjustes} onEditarRutina={setEditandoRutina} />;
  } else {
    // Calendario. También es el respaldo si el día activo no está en el mes
    // generado (mes cambiado, fecha fuera de rango): mejor que una pantalla vacía.
    pantalla = (
      <>
        <CalendarView onEditDay={setEditingDay} editMode={editMode} setEditMode={setEditMode} />
        {editingDay && (
          <EditModal dia={editingDay} onSave={saveEdit} onLiberar={liberarDia} onClose={() => setEditingDay(null)} />
        )}
      </>
    );
  }

  return (
    <>
      {pantalla}
      <BarraInferior activa={pestana} />
    </>
  );
}
