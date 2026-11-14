import React, { useState } from 'react';
import { ArrowUp, ArrowDown, X, RotateCcw } from 'lucide-react';
import { TURNO_INFO } from '../../data.js';
import { usePlanCtx, useAccionesCtx } from '../../estado/contextos.js';
import { conCampo, turnosDelPlan, LETRAS_TURNO, CICLO_DEFAULT, resolverConfig } from '../../config.js';
import { ChipTurno } from '../comunes/ui.jsx';
import { Pantalla, Interruptor, VistaPrevia } from './piezas.jsx';

// ═══════════════ TURNOS ═══════════════
// El ciclo de turnos (qué viene después de qué), qué turno es hoy, y qué se
// puede hacer en cada uno.
const dias = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5);
const mod = (x, n) => ((x % n) + n) % n;
// Posición del ciclo que cae HOY con una config resuelta (misma cuenta que turnoDe)
const posicionHoy = (cfg, ancla, hoy) => {
  const n = cfg.ciclo.length;
  const base = cfg.cicloHoy ? cfg.cicloHoy.pos - dias(cfg.cicloHoy.fecha, ancla.fecha) : Math.max(0, cfg.ciclo.indexOf(ancla.turno));
  return mod(base + dias(hoy, ancla.fecha), n);
};
const PERMISOS = [
  ['gym', 'Gym'],
  ['cardio', 'Running o bici'],
  ['natacion', 'Natación'],
  ['doblar', 'Dos sesiones el mismo día'],
];

const AjustesTurnos = ({ onVolver }) => {
  const { config, planCfg, ancla, todayISO } = usePlanCtx();
  const { setConfig } = useAccionesCtx();
  const [ciclo, setCiclo] = useState(() => [...planCfg.ciclo]);
  const [pos, setPos] = useState(() => posicionHoy(planCfg, ancla, todayISO));
  const [turnos, setTurnos] = useState(() => JSON.parse(JSON.stringify(planCfg.turnos)));

  const editarCiclo = (nuevo) => { setCiclo(nuevo); setPos(p => Math.min(p, nuevo.length - 1)); };
  const mover = (i, d) => { const n = [...ciclo]; [n[i], n[i + d]] = [n[i + d], n[i]]; editarCiclo(n); };
  const permiso = (t, k, v) => setTurnos(x => ({ ...x, [t]: { ...x[t], [k]: v } }));

  // El ciclo se guarda solo si cambió algo respecto al plan: la secuencia, o
  // el turno que cae hoy.
  const posPlan = posicionHoy(resolverConfig({}), ancla, todayISO);
  const cicloDelPlan = JSON.stringify(ciclo) === JSON.stringify(CICLO_DEFAULT) && pos === posPlan;
  const borrador = conCampo(conCampo(config, 'turnos', turnos), 'ciclo', cicloDelPlan ? null : { turnos: ciclo, hoy: { fecha: todayISO, pos } });
  const plan = turnosDelPlan();
  const esPlan = cicloDelPlan && LETRAS_TURNO.every(t => PERMISOS.every(([k]) => turnos[t][k] === plan[t][k]));
  const enCiclo = LETRAS_TURNO.filter(t => ciclo.includes(t));

  return (
    <Pantalla titulo="Turnos" subtitulo="Tu ciclo de turnos y qué cabe en cada uno."
      onVolver={onVolver} onGuardar={() => { setConfig(borrador); onVolver(); }}>
      <section className="rounded-3xl bg-tarjeta px-5 pt-4 pb-2">
        <div className="rotulo">Tu ciclo</div>
        <p className="text-sm text-tinta3 mt-1">Se repite en este orden, día tras día.</p>
        <ol className="mt-2 divide-y divide-divisor">
          {ciclo.map((t, i) => (
            <li key={i} className="min-h-[60px] py-2 flex items-center gap-3">
              <span className="w-5 text-sm text-mudo">{i + 1}</span>
              <ChipTurno turno={t} />
              <span className="flex-1 text-[17px] text-tinta">{TURNO_INFO[t].label}</span>
              <button onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`Subir el turno ${i + 1}`}
                className="w-11 h-11 rounded-xl bg-elevada text-tinta2 flex items-center justify-center disabled:opacity-30"><ArrowUp size={18} /></button>
              <button onClick={() => mover(i, 1)} disabled={i === ciclo.length - 1} aria-label={`Bajar el turno ${i + 1}`}
                className="w-11 h-11 rounded-xl bg-elevada text-tinta2 flex items-center justify-center disabled:opacity-30"><ArrowDown size={18} /></button>
              <button onClick={() => editarCiclo(ciclo.filter((_, j) => j !== i))} disabled={ciclo.length === 1} aria-label={`Quitar el turno ${i + 1}`}
                className="w-11 h-11 rounded-xl bg-elevada text-tinta2 flex items-center justify-center disabled:opacity-30"><X size={18} /></button>
            </li>
          ))}
        </ol>
        <div className="py-3 border-t border-divisor">
          <div className="text-sm text-tinta3 mb-2">Añadir al final</div>
          <div className="grid grid-cols-4 gap-2">
            {LETRAS_TURNO.map(t => (
              <button key={t} onClick={() => editarCiclo([...ciclo, t])} disabled={ciclo.length >= 14} aria-label={`Añadir ${TURNO_INFO[t].label}`}
                className="min-h-[56px] rounded-2xl bg-elevada flex flex-col items-center justify-center gap-1 disabled:opacity-30">
                <ChipTurno turno={t} size={20} />
                <span className="text-xs text-tinta2">{TURNO_INFO[t].label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-tarjeta px-5 py-4">
        <div className="rotulo">¿Qué turno te toca hoy?</div>
        <div className="flex flex-wrap gap-2 mt-3" role="radiogroup" aria-label="Turno de hoy">
          {ciclo.map((t, i) => (
            <button key={i} role="radio" aria-checked={pos === i} onClick={() => setPos(i)}
              className={`h-12 pl-1.5 pr-3.5 rounded-full flex items-center gap-2 text-[15px] ${pos === i ? 'bg-fondo text-tinta font-semibold' : 'bg-elevada text-tinta2'}`}
              style={pos === i ? { boxShadow: `inset 0 0 0 2px ${TURNO_INFO[t].color}` } : undefined}
              aria-label={`Hoy es el ${i + 1}: ${TURNO_INFO[t].label}`}>
              <ChipTurno turno={t} /> {i + 1} · {TURNO_INFO[t].label}
            </button>
          ))}
        </div>
        <p className="text-sm text-tinta3 mt-3 leading-relaxed">
          Cambiar el ciclo recalcula el calendario, también los días pasados sin entrenamiento.
          Los días con registro o fijados a mano no se mueven.
        </p>
      </section>

      <div className="rotulo px-1 pt-2">Qué cabe en cada turno</div>
      {enCiclo.map(t => (
        <section key={t} className="rounded-3xl bg-tarjeta">
          <div className="px-5 pt-4 pb-1 flex items-center gap-2">
            <ChipTurno turno={t} conNombre />
            {t === planCfg.turnoFlexible && <span className="text-sm text-tinta3">· aquí vive el día flexible</span>}
          </div>
          <div className="divide-y divide-divisor">
            {PERMISOS.map(([k, l]) => (
              <Interruptor key={k} label={`${l} en ${TURNO_INFO[t].label}`} activo={turnos[t][k]} onCambiar={(v) => permiso(t, k, v)} />
            ))}
          </div>
        </section>
      ))}

      <VistaPrevia config={borrador} />
      {!esPlan && (
        <button onClick={() => { setCiclo([...CICLO_DEFAULT]); setPos(posPlan); setTurnos(JSON.parse(JSON.stringify(plan))); }}
          className="w-full h-12 text-[15px] font-medium text-ambar flex items-center justify-center gap-2">
          <RotateCcw size={16} /> Volver a los turnos del plan
        </button>
      )}
    </Pantalla>
  );
};

export default AjustesTurnos;
