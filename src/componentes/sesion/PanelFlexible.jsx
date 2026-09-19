import React from 'react';
import { Zap } from 'lucide-react';
import { SESION_INFO, CARDIO_FLEXIBLE } from '../../data.js';
import { useAccionesCtx } from '../../estado/contextos.js';
import BotonSiNo from '../comunes/BotonSiNo.jsx';

// ═══════════════ DÍA FLEXIBLE · las tres condiciones ═══════════════
// Por defecto descanso. Pasa a running solo si se cumplen las TRES. La tercera
// la calcula el generador (no venir de dos días de gym seguidos); las otras dos
// dependen de datos que solo sabe el usuario, así que se preguntan.
const PanelFlexible = ({ dia, respuesta }) => {
  const { onFlexible: onResponder, onConvertirFlexible: onConvertir } = useAccionesCtx();
  const cond3 = dia.flexibleCond3 !== false;
  const durmio = respuesta?.sueno;
  const peso = respuesta?.peso;
  const todas = cond3 && durmio === true && peso === true;
  const contestadas = durmio != null && peso != null;
  // S3: running nunca el día después de pierna. Fijar el flexible a running lo
  // saltaría, porque los días fijados no pasan por las reglas del generador: se
  // quita de las opciones. La bici tras pierna es consejo (el cuádriceps sí
  // trabaja), no regla: se ofrece con el aviso.
  const opciones = (dia.sugerencia?.opciones ?? CARDIO_FLEXIBLE).filter(k => !(dia.trasPierna && k === 'running'));

  return (
    <div className="mb-3 rounded-lg border-l-4 border-slate-500 bg-slate-800/20 px-3 py-2.5">
      <div className="flex items-start gap-2 mb-2">
        <Zap size={15} className="text-slate-400 flex-shrink-0 mt-0.5" />
        <div className="text-[11px] text-slate-300 leading-relaxed">
          <span className="font-bold">Día flexible.</span> Es el día negociable de la semana y cae en turno C, que ya son
          12h de pie. Por defecto descansas; pasa a cardio solo si se cumplen las tres condiciones.
          {dia.sugerencia && (
            <span className="block mt-1 text-amber-300">{dia.sugerencia.motivo}</span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500 font-bold mb-1">¿Dormiste bien esta semana?</div>
          <div className="flex gap-1.5">
            <BotonSiNo activo={durmio === true} onClick={() => onResponder(dia.fecha, { sueno: true })}>Sí</BotonSiNo>
            <BotonSiNo activo={durmio === false} onClick={() => onResponder(dia.fecha, { sueno: false })}>No</BotonSiNo>
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500 font-bold mb-1">¿El peso corporal va subiendo?</div>
          <div className="flex gap-1.5">
            <BotonSiNo activo={peso === true} onClick={() => onResponder(dia.fecha, { peso: true })}>Sí</BotonSiNo>
            <BotonSiNo activo={peso === false} onClick={() => onResponder(dia.fecha, { peso: false })}>No</BotonSiNo>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <span className={cond3 ? 'text-emerald-400' : 'text-red-400'}>{cond3 ? '✓' : '✗'}</span>
          <span className="text-[11px] text-slate-400">
            No vienes de dos días de gym seguidos {cond3 ? '— cumplida' : '— NO cumplida, esta la calcula la app'}
          </span>
        </div>
      </div>

      {contestadas && (
        todas ? (
          <div className="mt-2.5 space-y-1.5">
            <p className="text-[11px] text-emerald-300 font-bold">Las tres se cumplen. ¿Qué haces hoy?</p>
            <div className="flex gap-1.5">
              {opciones.map(k => (
                <button key={k} onClick={() => onConvertir(dia.fecha, k)}
                  className="flex-1 py-2 rounded-lg text-white text-[11px] font-bold uppercase"
                  style={{ background: SESION_INFO[k].color }}>
                  {SESION_INFO[k].label}
                </button>
              ))}
            </div>
            {dia.trasPierna ? (
              <p className="text-[10px] text-amber-300/90 leading-relaxed">
                Ayer fue pierna: correr hoy viola S3, así que no se ofrece. La bici no tiene impacto pero el
                cuádriceps sí trabaja — si vas a hacerla, suave.
              </p>
            ) : (
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Vienes de 12h de pie: la bici da el mismo Z2 sin castigar pies, tibias ni sóleo, y de paso
                cubre el ciclismo que te falta para triatlón. Correr solo si los pies vienen bien.
              </p>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-slate-400 mt-2.5 leading-relaxed">
            No se cumplen las tres: hoy <span className="font-bold text-slate-300">descansas</span>.
            {!cond3 && ' Vienes de dos días de gym seguidos.'}
            {durmio === false && ' No dormiste bien.'}
            {peso === false && ' El peso no sube: come más antes de añadir cardio.'}
          </p>
        )
      )}
    </div>
  );
};

export default PanelFlexible;
