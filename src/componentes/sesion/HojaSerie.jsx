import React, { useState, useRef, useLayoutEffect, useCallback } from 'react';
import { Check, X } from 'lucide-react';
import { Hoja, BotonCTA } from '../comunes/ui.jsx';
import NumInput from '../comunes/NumInput.jsx';
import { textoSerie } from '../../utiles/serie.js';

// ═══════════════ AJUSTAR UNA SERIE · rueda ═══════════════
// Solo aparece cuando hay que cambiar algo: lo normal es «Hecha» de un toque.
// Cada columna es una rueda que se arrastra con el pulgar; encima queda el campo
// de texto de siempre, por si se prefiere teclear. Los dos mueven el mismo valor.
const ALTO = 48;        // alto de cada cifra
const VISIBLES = 5;

const KG = Array.from({ length: 81 }, (_, i) => i * 2.5);      // 0–200 de 2,5 en 2,5
const REPS = Array.from({ length: 51 }, (_, i) => i);          // 0–50

const masCercano = (valores, v) => {
  if (v == null || Number.isNaN(v)) return 0;
  let mejor = 0;
  valores.forEach((x, i) => { if (Math.abs(x - v) < Math.abs(valores[mejor] - v)) mejor = i; });
  return mejor;
};

const Rueda = ({ valores, valor, onCambiar, etiqueta, color }) => {
  const ref = useRef(null);
  const espera = useRef(null);
  const idx = masCercano(valores, valor);

  // La rueda sigue al valor (al abrir, y cuando se teclea en el campo).
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && Math.round(el.scrollTop / ALTO) !== idx) el.scrollTop = idx * ALTO;
  }, [idx]);

  // Al soltar, el valor es la cifra que quedó en el centro.
  const alDesplazar = useCallback(() => {
    clearTimeout(espera.current);
    espera.current = setTimeout(() => {
      const el = ref.current; if (!el) return;
      const i = Math.max(0, Math.min(valores.length - 1, Math.round(el.scrollTop / ALTO)));
      if (valores[i] !== valor) onCambiar(valores[i]);
    }, 90);
  }, [valores, valor, onCambiar]);

  const alTeclear = (e) => {
    const paso = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
    if (!paso) return;
    e.preventDefault();
    onCambiar(valores[Math.max(0, Math.min(valores.length - 1, idx + paso))]);
  };

  return (
    <div className="relative rounded-2xl bg-fondo overflow-hidden" style={{ height: ALTO * VISIBLES }}>
      <div aria-hidden="true" className="absolute inset-x-2 rounded-xl pointer-events-none"
        style={{ top: ALTO * 2, height: ALTO, background: color + '2e' }} />
      <div ref={ref} onScroll={alDesplazar} onKeyDown={alTeclear} tabIndex={0}
        role="spinbutton" aria-label={etiqueta} aria-valuenow={valores[idx]}
        aria-valuemin={valores[0]} aria-valuemax={valores.at(-1)}
        className="relative h-full overflow-y-scroll snap-y snap-mandatory sin-barra"
        style={{ paddingBlock: ALTO * 2 }}>
        {valores.map((v, i) => {
          const d = Math.abs(i - idx);
          return (
            <div key={v} onClick={() => onCambiar(v)}
              className={`snap-center flex items-center justify-center font-semibold cursor-pointer ${
                d === 0 ? 'text-3xl text-tinta' : d === 1 ? 'text-xl text-tinta3' : 'text-base text-mudo'}`}
              style={{ height: ALTO }}>
              {v}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const HojaSerie = ({ ex, indice, inicial, pista, color, marcada, onGuardar, onDesmarcar, onCerrar }) => {
  const [kg, setKg] = useState(inicial.kg);
  const [reps, setReps] = useState(inicial.reps);
  const num = (txt, entero) => (txt === '' ? null : entero ? parseInt(txt, 10) : parseFloat(txt));
  const log = { kg: kg ?? null, reps: reps ?? null };
  const texto = textoSerie(log);

  return (
    <Hoja onCerrar={onCerrar} etiqueta={`Ajustar serie ${indice + 1} de ${ex.nombre}`}>
      <div className="px-5 pt-3 pb-5">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold text-tinta leading-tight">Serie {indice + 1} · {ex.nombre}</h2>
            {pista && <p className="text-sm text-tinta3 mt-1">{pista}</p>}
          </div>
          <button onClick={onCerrar} aria-label="Cerrar sin guardar"
            className="w-11 h-11 rounded-full bg-elevada flex items-center justify-center text-tinta2 flex-shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <NumInput value={kg} onChange={(v) => setKg(num(v, false))} placeholder="kg" etiqueta="kg" w="w-24" />
              <span className="text-sm text-tinta3">kg</span>
            </div>
            <Rueda valores={KG} valor={kg} onCambiar={setKg} etiqueta="Rueda de kilos" color={color} />
          </div>
          <div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <NumInput value={reps} onChange={(v) => setReps(num(v, true))} placeholder="rep" etiqueta="rep" w="w-24" />
              <span className="text-sm text-tinta3">reps</span>
            </div>
            <Rueda valores={REPS} valor={reps} onCambiar={setReps} etiqueta="Rueda de repeticiones" color={color} />
          </div>
        </div>

        <BotonCTA color={color} className="mt-4" onClick={() => onGuardar(log)}>
          <Check size={22} strokeWidth={2.6} /> Guardar{texto ? ` · ${texto}` : ''}
        </BotonCTA>
        {marcada && (
          <button onClick={onDesmarcar} className="w-full h-11 mt-2 text-sm font-medium text-tinta3">
            Desmarcar esta serie
          </button>
        )}
      </div>
    </Hoja>
  );
};

export default HojaSerie;
