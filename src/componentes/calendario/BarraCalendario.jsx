import React from 'react';
import { ChevronLeft, ChevronRight, Check, Settings, Pencil } from 'lucide-react';
import { usePlanCtx, useProgresoCtx, useAccionesCtx } from '../../estado/contextos.js';
import { COLUMNA } from '../../utiles/constantes-ui.js';

// Cabecera del calendario: el mes, sus flechas, el modo edición y los ajustes.
const BarraCalendario = ({ editMode, setEditMode }) => {
  const { mesInfo, hayMesAnterior } = usePlanCtx();
  const { saveStatus } = useProgresoCtx();
  const { cambiarMes: onMes, irA } = useAccionesCtx();
  const boton = 'w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0';
  return (
    <header className="sticky top-0 z-30 bg-fondo">
      <div className={`px-4 pt-4 pb-3 flex items-center gap-1 ${COLUMNA}`}>
        <div className="flex-1 min-w-0">
          <h1 className="text-[26px] leading-8 font-semibold tracking-[-0.02em] text-tinta truncate">{mesInfo.nombre}<span className="sr-only"> {mesInfo.anio}</span></h1>
          <p className="text-sm text-tinta3 h-5 flex items-center gap-1">
            {mesInfo.anio}
            {saveStatus === 'saved' && <> · <Check size={14} strokeWidth={3} className="text-emerald-400" /> Guardado</>}
          </p>
        </div>
        <button onClick={() => onMes(-1)} aria-label="Mes anterior" disabled={!hayMesAnterior} className={`${boton} text-tinta2 disabled:opacity-30`}>
          <ChevronLeft size={24} />
        </button>
        <button onClick={() => onMes(1)} aria-label="Mes siguiente" className={`${boton} text-tinta2`}>
          <ChevronRight size={24} />
        </button>
        <button onClick={() => setEditMode(!editMode)} aria-label="Modo edición" aria-pressed={editMode}
          className={`${boton} ${editMode ? 'bg-ambar text-[#0d1215]' : 'text-tinta3'}`}>
          <Pencil size={20} />
        </button>
        <button onClick={() => irA('ajustes')} aria-label="Ajustes" className={`${boton} text-tinta3`}>
          <Settings size={22} />
        </button>
      </div>
    </header>
  );
};

export default BarraCalendario;
