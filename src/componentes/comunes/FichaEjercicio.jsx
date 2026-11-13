import React from 'react';
import Musculos from './Musculos.jsx';
import { Detalle } from './ui.jsx';

// Un ejercicio en modo consulta: sin casillas, sin campos.
// Se usa en la ficha que se abre desde Rutinas o desde el nombre de la sesión.
const FichaEjercicio = ({ ex, numero }) => (
  <div className="py-3">
    <div className="flex items-start gap-3">
      {numero != null && <span className="w-6 text-sm text-mudo pt-0.5 flex-shrink-0">{String(numero).padStart(2, '0')}</span>}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <h3 className="flex-1 text-[17px] font-medium text-tinta leading-snug">{ex.nombre}</h3>
          {ex.bs && <span className="h-6 px-2 rounded-lg bg-elevada text-xs font-semibold text-tinta2 inline-flex items-center flex-shrink-0">{ex.bs}</span>}
          {ex.opcional && <span className="h-6 px-2 rounded-lg bg-elevada text-xs font-semibold text-tinta2 inline-flex items-center flex-shrink-0">Opcional</span>}
        </div>
        <Musculos musculos={ex.musculos} className="mt-0.5" />
        <p className="text-[15px] text-tinta2 mt-1">
          {ex.series} × {ex.reps} · {ex.lineal ? `lineal ${ex.progresion}` : `RIR ${ex.rir ?? '—'}`} · {ex.descanso}
        </p>
        {ex.nota && <Detalle className="mt-2">{ex.nota}</Detalle>}
      </div>
    </div>
  </div>
);

export default FichaEjercicio;
