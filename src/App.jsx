import React, { useState, useCallback } from 'react';
import { contarRender } from './utiles/medir.js';
import { usePlanCtx, useAccionesCtx } from './estado/contextos.js';
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

  // App NO lee ContextoProgreso a propósito: así marcar una serie no lo
  // re-renderiza. Del plan solo necesita lo justo para enrutar.
  const { view, diaActivo } = usePlanCtx();
  const {
    saveEdit: saveEditBase, liberarDia: liberarDiaBase,
    guardarRutina: guardarRutinaBase, restaurarRutina: restaurarRutinaBase,
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
    return <FichaSesion sesionKey={fichaSesion} onCerrar={() => setFichaSesion(null)} />;
  }

  if (biblioteca) {
    return <Biblioteca onAbrir={setFichaSesion} onCerrar={() => setBiblioteca(false)} />;
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

  // Si hay día activo se enseña su sesión. Si por lo que sea no lo hay (mes
  // cambiado, fecha fuera de rango), se cae al calendario en lugar de dejar la
  // pantalla vacía.
  if (view === 'session' && activeDiaData) {
    return <SessionView onEditarRutina={setEditandoRutina} onVerFicha={setFichaSesion} />;
  }

  return (
    <>
      <CalendarView
        onEditDay={setEditingDay} editMode={editMode} setEditMode={setEditMode}
        onBiblioteca={() => setBiblioteca(true)}
      />
      {editingDay && (
        <EditModal dia={editingDay} onSave={saveEdit} onLiberar={liberarDia} onClose={() => setEditingDay(null)} />
      )}
    </>
  );
}
