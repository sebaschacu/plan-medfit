import React from 'react';
import { Zap } from 'lucide-react';
import { SESION_INFO, CARDIO_FLEXIBLE } from '../../data.js';
import { useAccionesCtx } from '../../estado/contextos.js';
import BotonSiNo from '../comunes/BotonSiNo.jsx';

// ═══════════════ DÍA FLEXIBLE · las tres condiciones ═══════════════
// Por defecto descanso. Pasa a running solo si se cumplen las TRES. La tercera
// la calcula el generador (no venir de dos días de gym seguidos); las otras dos
// dependen de datos que solo sabe el usuario, así que se preguntan.
//
// EXCEPCIÓN · cardio por defecto. Si el cardio de la semana no cupo en ningún
// otro día, el generador ya ha puesto BICI en este (lo importante es no
// saltárselo). Aquí no se pregunta nada: se explica y se ofrece cambiar a
// running —si apetece correr— o a descanso —si no se dormió o el peso no sube—.
const PanelFlexible = ({ dia, respuesta }) => {
  const { onFlexible: onResponder, onConvertirFlexible: onConvertir } = useAccionesCtx();
  if (dia.cardioPorDefecto) {
    return (
      <div className="rounded-3xl bg-tarjeta p-5">
        <div className="flex items-start gap-3 mb-3">
          <Zap size={18} className="flex-shrink-0 mt-0.5" style={{ color: SESION_INFO.ciclismo.color }} />
          <div className="text-[15px] text-tinta2 leading-relaxed">
            <span className="font-bold">Día flexible · hoy bici por defecto.</span> {dia.sugerencia?.motivo}
          </div>
        </div>
        <div className="flex gap-2.5">
          <button onClick={() => onConvertir(dia.fecha, 'running')} aria-label="Correr en su lugar"
            className="flex-1 h-12 rounded-2xl text-[15px] font-semibold text-[#0d1215]"
            style={{ background: SESION_INFO.running.color }}>
            Correr en su lugar
          </button>
          <button onClick={() => onConvertir(dia.fecha, 'descanso')} aria-label="Hoy descanso"
            className="flex-1 h-12 rounded-2xl text-[15px] font-semibold text-tinta bg-elevada">
            Hoy descanso
          </button>
        </div>
        <p className="text-sm text-tinta3 leading-relaxed mt-1.5">
          Cualquiera de los dos fija el día: el generador lo respeta al recalcular. Se deshace desde el modo edición (liberar día).
        </p>
      </div>
    );
  }
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
    <div className="rounded-3xl bg-tarjeta p-5">
      <div className="flex items-start gap-3 mb-3">
        <Zap size={18} className="text-tinta3 flex-shrink-0 mt-0.5" />
        <div className="text-[15px] text-tinta2 leading-relaxed">
          <span className="font-bold">Día flexible.</span> Es el día negociable de la semana y cae en turno C, que ya son
          12h de pie. Por defecto descansas; pasa a cardio solo si se cumplen las tres condiciones.
          {dia.sugerencia && (
            <span className="block mt-1 text-ambar">{dia.sugerencia.motivo}</span>
          )}
        </div>
      </div>

      <div className="space-y-4 mt-3">
        <div>
          <div className="text-[15px] text-tinta mb-2">¿Dormiste bien esta semana?</div>
          <div className="flex gap-2.5">
            <BotonSiNo activo={durmio === true} onClick={() => onResponder(dia.fecha, { sueno: true })}>Sí</BotonSiNo>
            <BotonSiNo activo={durmio === false} onClick={() => onResponder(dia.fecha, { sueno: false })}>No</BotonSiNo>
          </div>
        </div>
        <div>
          <div className="text-[15px] text-tinta mb-2">¿El peso corporal va subiendo?</div>
          <div className="flex gap-2.5">
            <BotonSiNo activo={peso === true} onClick={() => onResponder(dia.fecha, { peso: true })}>Sí</BotonSiNo>
            <BotonSiNo activo={peso === false} onClick={() => onResponder(dia.fecha, { peso: false })}>No</BotonSiNo>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <span className={cond3 ? 'text-emerald-400' : 'text-red-400'}>{cond3 ? '✓' : '✗'}</span>
          <span className="text-sm text-tinta3">
            No vienes de dos días de gym seguidos {cond3 ? '— cumplida' : '— NO cumplida, esta la calcula la app'}
          </span>
        </div>
      </div>

      {contestadas && (
        todas ? (
          <div className="mt-2.5 space-y-1.5">
            <p className="text-[13px] text-emerald-300 font-bold">Las tres se cumplen. ¿Qué haces hoy?</p>
            <div className="flex gap-2.5">
              {opciones.map(k => (
                <button key={k} onClick={() => onConvertir(dia.fecha, k)}
                  className="flex-1 h-12 rounded-2xl text-[15px] font-semibold text-[#0d1215]"
                  style={{ background: SESION_INFO[k].color }}>
                  {SESION_INFO[k].label}
                </button>
              ))}
            </div>
            {dia.trasPierna ? (
              <p className="text-sm text-ambar leading-relaxed">
                Ayer fue pierna: correr hoy viola S3, así que no se ofrece. La bici no tiene impacto pero el
                cuádriceps sí trabaja — si vas a hacerla, suave.
              </p>
            ) : (
              <p className="text-sm text-tinta3 leading-relaxed">
                Vienes de 12h de pie: la bici da el mismo Z2 sin castigar pies, tibias ni sóleo, y de paso
                cubre el ciclismo que te falta para triatlón. Correr solo si los pies vienen bien.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-tinta3 mt-2.5 leading-relaxed">
            No se cumplen las tres: hoy <span className="font-bold text-tinta2">descansas</span>.
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
