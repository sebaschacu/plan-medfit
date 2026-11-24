import React, { useState, useRef, useLayoutEffect, useCallback } from 'react';
import { Check, X } from 'lucide-react';
import { Hoja, BotonCTA } from '../comunes/ui.jsx';
import NumInput from '../comunes/NumInput.jsx';
import { textoSerie } from '../../utiles/serie.js';

// ═══════════════ AJUSTAR UNA SERIE · rueda ═══════════════
// Solo aparece cuando hay que cambiar algo: lo normal es «Hecha» de un toque.
// Cada columna es una rueda que se arrastra con el pulgar; encima queda el campo
// de texto de siempre, por si se prefiere teclear. Los dos mueven el mismo valor,
// pero solo el dedo manda en la rueda: lo tecleado se guarda TAL CUAL (40, 41,5)
// y la rueda se coloca en la cifra más cercana sin pisarlo. Antes, al teclear
// «4» la rueda saltaba a 5 y, al moverse sola, cambiaba el número a 5.
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
  const tocada = useRef(false);   // el dedo (o la rueda del ratón) la movió
  const idx = masCercano(valores, valor);

  // La rueda sigue al valor (al abrir, y cuando se teclea en el campo). Ese
  // movimiento no es del dedo: lo que quedara de un toque anterior se olvida.
  useLayoutEffect(() => {
    tocada.current = false;
    const el = ref.current;
    if (el && Math.round(el.scrollTop / ALTO) !== idx) el.scrollTop = idx * ALTO;
  }, [idx]);

  // Al soltar, el valor es la cifra que quedó en el centro. Un desplazamiento
  // que no empezó con el dedo (la rueda siguiendo a lo tecleado) no cambia nada.
  const alDesplazar = useCallback(() => {
    if (!tocada.current) return;
    clearTimeout(espera.current);
    espera.current = setTimeout(() => {
      const el = ref.current; if (!el) return;
      tocada.current = false;
      const i = Math.max(0, Math.min(valores.length - 1, Math.round(el.scrollTop / ALTO)));
      if (valores[i] !== valor) onCambiar(valores[i]);
    }, 90);
  }, [valores, valor, onCambiar]);
  const alTocar = () => { tocada.current = true; };

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
        onPointerDown={alTocar} onTouchStart={alTocar} onWheel={alTocar}
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
  // El campo guarda el TEXTO tecleado: «41.» tiene que seguir siendo «41.» para
  // poder escribir 41,5 cifra a cifra (como número se quedaba en 41).
  const [kgTxt, setKgTxt] = useState(inicial.kg ?? '');
  const [repsTxt, setRepsTxt] = useState(inicial.reps ?? '');
  const num = (txt, entero) => {
    if (txt === '' || txt === '.') return null;
    const n = entero ? parseInt(txt, 10) : parseFloat(txt);
    return Number.isNaN(n) ? null : n;
  };
  const teclearKg = (v) => { setKgTxt(v); setKg(num(v, false)); };
  const teclearReps = (v) => { setRepsTxt(v); setReps(num(v, true)); };
  const ruedaKg = (v) => { setKg(v); setKgTxt(v); };
  const ruedaReps = (v) => { setReps(v); setRepsTxt(v); };
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
              <NumInput value={kgTxt} onChange={teclearKg} placeholder="kg" etiqueta="kg" w="w-24" />
              <span className="text-sm text-tinta3">kg</span>
            </div>
            <Rueda valores={KG} valor={kg} onCambiar={ruedaKg} etiqueta="Rueda de kilos" color={color} />
          </div>
          <div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <NumInput value={repsTxt} onChange={teclearReps} placeholder="rep" etiqueta="rep" w="w-24" />
              <span className="text-sm text-tinta3">reps</span>
            </div>
            <Rueda valores={REPS} valor={reps} onCambiar={ruedaReps} etiqueta="Rueda de repeticiones" color={color} />
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
