import React, { useState } from 'react';
import { Hoja } from '../comunes/ui.jsx';
import { normalizar } from '../../alternativas.js';

// ═══════════════ CAMBIAR UN EJERCICIO ═══════════════
// Mismo músculo, otro equipo. Una lista para elegir y dos salidas:
// «Solo hoy» (la próxima vez vuelve el de la rutina) o «Desde ahora»
// (la rutina cambia). Cada alternativa guarda su propio historial de kilos.
const HojaCambio = ({ opciones, actual, enRutina, plan, color, onSoloHoy, onDesdeAhora, onCerrar }) => {
  const [elegida, setElegida] = useState(actual);
  const igual = (a, b) => normalizar(a) === normalizar(b);
  const esRutina = igual(elegida, enRutina);

  return (
    <Hoja onCerrar={onCerrar} etiqueta={`Cambiar ${actual}`}>
      <div className="px-5 pt-3 pb-5">
        <h2 className="text-xl font-semibold text-tinta">Cambiar ejercicio</h2>
        <p className="text-sm text-tinta3 mt-1">Mismo músculo, otro equipo. Cada uno guarda sus propios kilos.</p>

        <div role="radiogroup" aria-label="Alternativas" className="mt-3 divide-y divide-divisor">
          {opciones.map(o => {
            const sel = igual(o, elegida);
            return (
              <button key={o} role="radio" aria-checked={sel} onClick={() => setElegida(o)}
                className="w-full min-h-[56px] py-2 flex items-center gap-3 text-left">
                <span className={`flex-1 min-w-0 text-[17px] ${sel ? 'text-tinta font-medium' : 'text-tinta2'}`}>{o}</span>
                {igual(o, actual) && <span className="text-xs text-tinta3 flex-shrink-0">Ahora</span>}
                {igual(o, plan) && !igual(o, actual) && <span className="text-xs text-tinta3 flex-shrink-0">Tu plan</span>}
                <span aria-hidden="true" className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center"
                  style={{ boxShadow: `inset 0 0 0 1.5px ${sel ? color : '#3a454e'}` }}>
                  {sel && <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex gap-2.5">
          <button onClick={() => onSoloHoy(esRutina ? null : elegida)} disabled={igual(elegida, actual)}
            className="flex-1 h-[56px] rounded-[18px] text-base font-semibold text-[#0d1215] disabled:opacity-40"
            style={{ background: color }}>
            Solo hoy
          </button>
          <button onClick={() => onDesdeAhora(elegida)} disabled={esRutina}
            className="flex-1 h-[56px] rounded-[18px] text-base font-semibold bg-elevada text-tinta disabled:opacity-40">
            Desde ahora
          </button>
        </div>
      </div>
    </Hoja>
  );
};

export default HojaCambio;
