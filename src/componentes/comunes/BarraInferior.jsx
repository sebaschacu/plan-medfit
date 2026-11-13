import React from 'react';
import { Target, Calendar, ChartColumn, Library } from 'lucide-react';
import { useAccionesCtx } from '../../estado/contextos.js';
import { COLUMNA } from '../../utiles/constantes-ui.js';

// ═══════════════ BARRA INFERIOR ═══════════════
// Las cuatro pestañas, siempre en el mismo sitio y al alcance del pulgar.
const PESTANAS = [
  ['hoy', 'Hoy', Target],
  ['calendar', 'Calendario', Calendar],
  ['progreso', 'Progreso', ChartColumn],
  ['rutinas', 'Rutinas', Library],
];

const BarraInferior = ({ activa }) => {
  const { irA } = useAccionesCtx();
  return (
    <nav aria-label="Secciones" className="fixed bottom-0 inset-x-0 z-40 bg-fondo border-t border-divisor pb-[env(safe-area-inset-bottom)]">
      <div className={`h-[72px] grid grid-cols-4 ${COLUMNA}`}>
        {PESTANAS.map(([k, label, Icono]) => {
          const on = activa === k;
          return (
            <button key={k} onClick={() => irA(k)} aria-current={on ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-1 text-xs ${on ? 'text-tinta font-semibold' : 'text-tinta3'}`}>
              <Icono size={22} strokeWidth={on ? 2.2 : 1.8} aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BarraInferior;
