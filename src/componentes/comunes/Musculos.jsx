import React from 'react';
import { MUSCULOS } from '../../data.js';

// Qué músculos trabaja un ejercicio, visible sin tocar nada. Primarios delante
// y más marcados; secundarios detrás y apagados. El dato ya estaba en data.js
// para las estadísticas de volumen; aquí solo se enseña.
//
// Tolera `musculos` malformado (respaldos anteriores a la v6): lo que no sea un
// array se trata como vacío, igual que en VolumenMuscular y validador.js.
const etiqueta = (clave) => MUSCULOS[clave]?.label ?? clave;

const Musculos = ({ musculos, className = '' }) => {
  const prim = Array.isArray(musculos?.primario) ? musculos.primario : [];
  const sec = Array.isArray(musculos?.secundario) ? musculos.secundario : [];
  if (!prim.length && !sec.length) return null;
  return (
    <p className={`text-[10px] leading-snug ${className}`} aria-label="Músculos que trabaja">
      {prim.map((m, i) => (
        <span key={m} className="font-semibold text-slate-300">
          {i > 0 && <span className="text-slate-600 font-normal"> · </span>}{etiqueta(m)}
        </span>
      ))}
      {sec.length > 0 && (
        <span className="text-slate-500">
          {prim.length > 0 && <span className="text-slate-600"> · </span>}
          {sec.map(etiqueta).join(' · ')}
        </span>
      )}
    </p>
  );
};

export default Musculos;
