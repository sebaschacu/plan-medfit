import React from 'react';
import { MUSCULOS } from '../../data.js';

// ═══════════════ ELEGIR MÚSCULOS ═══════════════
// Cada músculo es una pastilla de tres estados. Un toque: principal. Otro:
// secundario. Otro: fuera. Los principales cuentan una serie entera en el
// volumen semanal; los secundarios, media.
const CATS = [['empuje', 'Empuje'], ['traccion', 'Tracción'], ['pierna', 'Pierna'], ['core', 'Core']];

const SelectorMusculos = ({ musculos, onCambiar }) => {
  const prim = Array.isArray(musculos?.primario) ? musculos.primario : [];
  const sec = Array.isArray(musculos?.secundario) ? musculos.secundario : [];
  const tocar = (k) => {
    if (prim.includes(k)) onCambiar({ primario: prim.filter(m => m !== k), secundario: [...sec, k] });
    else if (sec.includes(k)) onCambiar({ primario: prim, secundario: sec.filter(m => m !== k) });
    else onCambiar({ primario: [...prim, k], secundario: sec });
  };
  const grupos = CATS.map(([c, label]) => [label, Object.entries(MUSCULOS).filter(([, m]) => m.cat === c)]);
  const otros = Object.entries(MUSCULOS).filter(([, m]) => !CATS.some(([c]) => c === m.cat));
  if (otros.length) grupos.push(['Otros', otros]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-tinta3">Un toque: <b className="text-tinta">principal</b>. Dos: <span className="text-tinta2">secundario</span>. Tres: quitar.</p>
      {grupos.map(([label, lista]) => (
        <div key={label}>
          <div className="text-sm text-tinta3 mb-1.5">{label}</div>
          <div className="flex flex-wrap gap-2">
            {lista.map(([k, m]) => {
              const estado = prim.includes(k) ? 'principal' : sec.includes(k) ? 'secundario' : 'no';
              return (
                <button key={k} onClick={() => tocar(k)} aria-label={`${m.label}: ${estado === 'no' ? 'sin elegir' : estado}`}
                  aria-pressed={estado !== 'no'}
                  className={`h-11 px-3.5 rounded-xl text-[15px] font-medium ${estado === 'principal' ? 'text-[#0d1215]' : estado === 'secundario' ? 'text-tinta' : 'bg-fondo text-tinta3'}`}
                  style={estado === 'principal' ? { background: m.color } : estado === 'secundario' ? { boxShadow: `inset 0 0 0 2px ${m.color}` } : undefined}>
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SelectorMusculos;
