import React, { useState } from 'react';
import { calcularUmbralRun, tablaZonasRun, mmss } from '../../reglas.js';
import { ZONAS_RUN } from '../../data.js';
import { usePlanCtx, useAccionesCtx } from '../../estado/contextos.js';
import { Detalle } from '../comunes/ui.jsx';

// ═══════════════ RUNNING · TEST DE 30 MIN Y ZONAS ═══════════════
// Sin reloj ni pulsómetro, la intensidad va por el test del habla y el esfuerzo
// percibido: eso sale siempre. Con el test hecho, además el ritmo por km.
const AZUL = '#0891b2';
const campo = 'w-full h-[60px] px-3 bg-fondo border border-borde focus:border-[#0891b2] focus:outline-none text-tinta text-[28px] font-semibold text-center rounded-2xl placeholder:text-mudo';

const PanelRitmosRun = ({ esTest }) => {
  const { umbralRun } = usePlanCtx();
  const { setUmbralRun } = useAccionesCtx();
  const [km, setKm] = useState('');
  const calc = km ? calcularUmbralRun(km) : null;
  const zonas = tablaZonasRun(umbralRun, ZONAS_RUN);

  return (
    <div className="mb-3 space-y-3">
      {esTest && (
        <section className="rounded-3xl bg-tarjeta p-5">
          <div className="rotulo" style={{ color: AZUL }}>Test de 30 min</div>
          <p className="text-[15px] text-tinta2 leading-relaxed mt-1.5">
            Apunta los kilómetros que hiciste en los 30 min y la app calcula tu ritmo umbral. Formato <b className="text-tinta">6.2</b>.
          </p>
          <label className="block mt-4">
            <span className="block text-sm text-tinta3 mb-1.5">Distancia en 30 min (km)</span>
            <input value={km} onChange={e => setKm(e.target.value)} placeholder="6.2" inputMode="decimal"
              aria-label="Kilómetros en 30 minutos" className={campo} />
          </label>
          {calc?.aviso && <p className="text-sm text-ambar mt-3">{calc.aviso}</p>}
          {calc?.segPorKm && (
            <>
              <p className="text-sm text-tinta3 mt-3">Ritmo umbral = 30:00 ÷ {calc.km} km = <b className="text-tinta">{mmss(calc.segPorKm)} / km</b></p>
              {!calc.aviso && (
                <button onClick={() => setUmbralRun(Math.round(calc.segPorKm))}
                  className="w-full h-[60px] mt-3 rounded-[18px] text-lg font-semibold text-[#0d1215]" style={{ background: AZUL }}>
                  Guardar ritmo {mmss(calc.segPorKm)} / km
                </button>
              )}
            </>
          )}
        </section>
      )}

      <section className="rounded-3xl bg-tarjeta p-5">
        <div className="flex items-baseline gap-2 flex-wrap">
          <div className="rotulo flex-1">Tus zonas</div>
          {umbralRun != null && (
            <div className="text-[15px] text-tinta2">Umbral <b className="text-2xl text-tinta font-semibold">{mmss(umbralRun)}</b> / km</div>
          )}
        </div>
        <div role="table" aria-label="Zonas de running" className="mt-2 divide-y divide-divisor">
          {ZONAS_RUN.map((z, i) => (
            <div role="row" key={z.clave} className="py-2.5">
              <div className="flex items-baseline gap-2">
                <span role="cell" className="text-[17px] font-semibold text-tinta flex-1">{z.clave}</span>
                <span role="cell" className="text-[17px] text-tinta tabular-nums">
                  {zonas.length ? `${zonas[i].rapido}–${zonas[i].lento}` : `RPE ${z.rpe}`}
                </span>
              </div>
              <div role="cell" className="text-sm text-tinta3 leading-snug mt-0.5">
                {z.habla}{zonas.length ? ` · RPE ${z.rpe}` : ''}
              </div>
            </div>
          ))}
        </div>
        {umbralRun == null ? (
          <p className="text-[15px] text-tinta3 leading-relaxed mt-2">
            Aún no tienes ritmo umbral: ve por sensaciones (cómo hablas y el esfuerzo de 1 a 10). Para tener ritmos por km,
            haz el Test 30 min: elígelo en el día, en «Cambiar la sesión de hoy».
          </p>
        ) : (
          <Detalle className="mt-3" resumen="Cómo usar las zonas">
            Ritmos por km, del más rápido al más lento. Si el día está caluroso o vienes de turno, manda la sensación, no el reloj.
            Repite el test cada ~12 carreras: si mejoras, las zonas se mueven solas.
          </Detalle>
        )}
      </section>
    </div>
  );
};

export default PanelRitmosRun;
