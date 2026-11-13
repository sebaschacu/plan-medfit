import React, { useState } from 'react';
import { calcularCSS, tablaRitmos, mmss } from '../../reglas.js';
import { usePlanCtx, useAccionesCtx } from '../../estado/contextos.js';
import { Detalle } from '../comunes/ui.jsx';

// ═══════════════ CSS · TEST Y TABLA DE RITMOS ═══════════════
// Sin este número todos los ritmos del plan son adivinanzas. La tabla se enseña
// en toda sesión de agua porque en el borde de la piscina no se va calculando.
const AZUL = '#06b6d4';
const campo = 'w-full h-[60px] px-3 bg-fondo border border-borde focus:border-[#06b6d4] focus:outline-none text-tinta text-[28px] font-semibold text-center rounded-2xl placeholder:text-mudo';

const PanelCSS = ({ esTest }) => {
  const { css } = usePlanCtx();
  const { setCss: onCSS } = useAccionesCtx();
  const [t400, setT400] = useState('');
  const [t200, setT200] = useState('');
  const calc = (t400 && t200) ? calcularCSS(t400, t200) : null;
  const activo = css ?? calc?.segPor100 ?? null;
  const tabla = tablaRitmos(activo);

  return (
    <div className="mb-3 space-y-3">
      {esTest && (
        <section className="rounded-3xl bg-tarjeta p-5">
          <div className="rotulo" style={{ color: AZUL }}>Test de CSS</div>
          <p className="text-[15px] text-tinta2 leading-relaxed mt-1.5">
            Apunta los dos tiempos y la app calcula tu CSS. Formato <b className="text-tinta">6:40</b> o segundos.
          </p>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <label className="block">
              <span className="block text-sm text-tinta3 mb-1.5">400 m</span>
              <input value={t400} onChange={e => setT400(e.target.value)} placeholder="6:40" inputMode="numeric" aria-label="Tiempo de los 400 metros" className={campo} />
            </label>
            <label className="block">
              <span className="block text-sm text-tinta3 mb-1.5">200 m</span>
              <input value={t200} onChange={e => setT200(e.target.value)} placeholder="3:10" inputMode="numeric" aria-label="Tiempo de los 200 metros" className={campo} />
            </label>
          </div>
          {calc?.error && <p className="text-sm text-red-400 mt-3">{calc.error}</p>}
          {calc?.aviso && <p className="text-sm text-ambar mt-3">{calc.aviso}</p>}
          {calc?.segPor100 && !calc.error && (
            <>
              <p className="text-sm text-tinta3 mt-3">Ritmo por 100 m = ({t400} − {t200}) ÷ 2 = <b className="text-tinta">{mmss(calc.segPor100)}</b></p>
              <button onClick={() => onCSS(calc.segPor100)}
                className="w-full h-[60px] mt-3 rounded-[18px] text-lg font-semibold text-[#0d1215]" style={{ background: AZUL }}>
                Guardar CSS {mmss(calc.segPor100)}
              </button>
            </>
          )}
        </section>
      )}

      <section className="rounded-3xl bg-tarjeta p-5">
        <div className="flex items-baseline gap-2">
          <div className="rotulo flex-1">Tus ritmos</div>
          {activo != null && (
            <div className="text-[15px] text-tinta2">CSS <b className="text-2xl text-tinta font-semibold">{mmss(activo)}</b> / 100 m</div>
          )}
        </div>
        {tabla.length > 0 ? (
          <>
            <div role="table" aria-label="Ritmos por distancia" className="mt-3 text-[15px]">
              <div role="row" className="grid grid-cols-5 text-sm text-tinta3 pb-1.5">
                <span role="columnheader">Ritmo</span>
                {['50', '100', '200', '400'].map(m => <span key={m} role="columnheader" className="text-right">{m}</span>)}
              </div>
              {tabla.map(r => {
                const css_ = r.clave === 'CSS';
                return (
                  <div role="row" key={r.clave}
                    className={`grid grid-cols-5 py-2 px-2 -mx-2 rounded-xl ${css_ ? 'text-tinta font-semibold' : 'text-tinta2'}`}
                    style={css_ ? { background: 'rgba(6,182,212,0.14)' } : undefined}>
                    <span role="cell">{r.clave}</span>
                    <span role="cell" className="text-right">{r.por50}</span>
                    <span role="cell" className="text-right">{r.por100}</span>
                    <span role="cell" className="text-right">{r.por200}</span>
                    <span role="cell" className="text-right">{r.por400}</span>
                  </div>
                );
              })}
            </div>
            <Detalle className="mt-3" resumen="Cómo usar la tabla">
              {tabla.find(r => r.clave === 'CSS+5')?.uso && 'CSS+5 para aeróbico sostenido · CSS−5 para series cortas. '}
              Repite el test cada 6-8 semanas: es tu métrica principal.
            </Detalle>
          </>
        ) : (
          <p className="text-[15px] text-tinta3 leading-relaxed mt-2">
            Aún no tienes CSS. Hazte el test en tu primera sesión: sin ese número, los ritmos del plan son adivinanzas.
          </p>
        )}
      </section>
    </div>
  );
};

export default PanelCSS;
