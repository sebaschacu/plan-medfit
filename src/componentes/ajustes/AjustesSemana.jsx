import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { usePlanCtx, useAccionesCtx } from '../../estado/contextos.js';
import { conCampo, cupoDelPlan, LIMITES_CUPO } from '../../config.js';
import { Pantalla, Paso, Interruptor, VistaPrevia } from './piezas.jsx';

// ═══════════════ TU SEMANA ═══════════════
// Cuántas sesiones de cada cosa quieres por semana. La app las reparte sola
// con las mismas reglas de siempre (turnos, S1, S3, S7, dobles).
const AjustesSemana = ({ onVolver }) => {
  const { config, planCfg } = usePlanCtx();
  const { setConfig } = useAccionesCtx();
  const [cupo, setCupo] = useState(() => ({
    gym: planCfg.cupo.gym, natacion: planCfg.cupo.natacion, cardio: planCfg.cupo.running, flexible: planCfg.cupo.flexible,
  }));
  const cambia = (k) => (v) => setCupo(c => ({ ...c, [k]: v }));
  const borrador = conCampo(config, 'cupo', cupo);
  const plan = cupoDelPlan();
  const esPlan = ['gym', 'natacion', 'cardio', 'flexible'].every(k => cupo[k] === plan[k]);

  return (
    <Pantalla titulo="Tu semana" subtitulo="Cuántas veces quieres hacer cada cosa a la semana."
      onVolver={onVolver} onGuardar={() => { setConfig(borrador); onVolver(); }}>
      <section className="rounded-3xl bg-tarjeta divide-y divide-divisor">
        <Paso label="Gym" valor={cupo.gym} min={LIMITES_CUPO.gym[0]} max={LIMITES_CUPO.gym[1]} onCambiar={cambia('gym')} />
        <Paso label="Natación" valor={cupo.natacion} min={LIMITES_CUPO.natacion[0]} max={LIMITES_CUPO.natacion[1]} onCambiar={cambia('natacion')} />
        <Paso label="Running o bici" valor={cupo.cardio} min={LIMITES_CUPO.cardio[0]} max={LIMITES_CUPO.cardio[1]} onCambiar={cambia('cardio')} />
        <Interruptor label="Día flexible" sub="Un día de turno C que pasa a cardio si dormiste bien y el peso sube"
          activo={!!cupo.flexible} onCambiar={(v) => cambia('flexible')(v ? 1 : 0)} />
      </section>
      <p className="text-sm text-tinta3 leading-relaxed px-1">
        Si algo no cabe en un día libre, la app lo dobla con otra sesión (como mucho 2 días por semana) o te avisa de que no cupo.
        Tus deportes propios se cuentan aparte, en Deportes.
      </p>
      <VistaPrevia config={borrador} />
      {!esPlan && (
        <button onClick={() => setCupo(plan)} className="w-full h-12 text-[15px] font-medium text-ambar flex items-center justify-center gap-2">
          <RotateCcw size={16} /> Volver a lo del plan: {plan.gym} gym · {plan.natacion} natación · {plan.cardio} cardio
        </button>
      )}
    </Pantalla>
  );
};

export default AjustesSemana;
