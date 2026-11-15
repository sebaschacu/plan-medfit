import React, { useState } from 'react';
import { ArrowUp, ArrowDown, X, Plus, RotateCcw, AlertTriangle } from 'lucide-react';
import { SESION_INFO, SECUENCIA_GYM, SECUENCIA_NATACION, SECUENCIA_RUNNING, RUNNING_SESIONES } from '../../data.js';
import { solapanGym } from '../../generador.js';
import { usePlanCtx, useAccionesCtx } from '../../estado/contextos.js';
import { conCampo, solapesDeRotacion } from '../../config.js';
import { Punto } from '../comunes/ui.jsx';
import { Pantalla, VistaPrevia } from './piezas.jsx';

// ═══════════════ ORDEN DE ROTACIÓN ═══════════════
// Qué sesión viene después de cuál, en el gym, la piscina y el running. La cola nunca
// se reinicia: cambiar el orden cambia lo que toca a partir de ahora.
const Lista = ({ titulo, orden, todas, onCambiar, nombre }) => {
  const fuera = todas.filter(k => !orden.includes(k));
  const mover = (i, d) => { const n = [...orden]; [n[i], n[i + d]] = [n[i + d], n[i]]; onCambiar(n); };
  return (
    <section className="rounded-3xl bg-tarjeta px-5 pt-4 pb-2">
      <div className="rotulo">{titulo}</div>
      <ol className="mt-2 divide-y divide-divisor">
        {orden.map((k, i) => (
          <li key={k} className="min-h-[60px] py-2 flex items-center gap-3">
            <span className="w-5 text-sm text-mudo">{i + 1}</span>
            <Punto color={SESION_INFO[k].color} />
            <span className="flex-1 min-w-0 text-[17px] text-tinta leading-snug">{SESION_INFO[k].label}</span>
            <button onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`Subir ${SESION_INFO[k].label} en ${nombre}`}
              className="w-11 h-11 rounded-xl bg-elevada text-tinta2 flex items-center justify-center disabled:opacity-30"><ArrowUp size={18} /></button>
            <button onClick={() => mover(i, 1)} disabled={i === orden.length - 1} aria-label={`Bajar ${SESION_INFO[k].label} en ${nombre}`}
              className="w-11 h-11 rounded-xl bg-elevada text-tinta2 flex items-center justify-center disabled:opacity-30"><ArrowDown size={18} /></button>
            <button onClick={() => onCambiar(orden.filter(x => x !== k))} disabled={orden.length === 1} aria-label={`Sacar ${SESION_INFO[k].label} de ${nombre}`}
              className="w-11 h-11 rounded-xl bg-elevada text-tinta2 flex items-center justify-center disabled:opacity-30"><X size={18} /></button>
          </li>
        ))}
      </ol>
      {fuera.length > 0 && (
        <div className="border-t border-divisor pt-3 pb-1">
          <div className="text-sm text-tinta3 mb-1">Fuera de la rotación</div>
          {fuera.map(k => (
            <button key={k} onClick={() => onCambiar([...orden, k])} aria-label={`Volver a meter ${SESION_INFO[k].label} en ${nombre}`}
              className="w-full min-h-[52px] flex items-center gap-3 text-left">
              <Punto color={SESION_INFO[k].color} />
              <span className="flex-1 text-[17px] text-tinta3">{SESION_INFO[k].label}</span>
              <Plus size={18} className="text-tinta3" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
};

const AjustesRotacion = ({ onVolver }) => {
  const { config, planCfg } = usePlanCtx();
  const { setConfig } = useAccionesCtx();
  const [gym, setGym] = useState(() => [...planCfg.secGym]);
  const [nat, setNat] = useState(() => [...planCfg.secNat]);
  const [run, setRun] = useState(() => [...planCfg.secRun]);
  const borrador = conCampo(config, 'rotacion', { gym, natacion: nat, running: run });
  const solapes = solapesDeRotacion(gym, solapanGym);
  const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const esPlan = igual(gym, SECUENCIA_GYM) && igual(nat, SECUENCIA_NATACION) && igual(run, SECUENCIA_RUNNING);
  const sinUmbral = !nat.includes('natB1');
  const sinTempo = !run.includes('runB1');

  return (
    <Pantalla titulo="Orden de rotación" subtitulo="Qué sesión viene después de cuál. La lista se repite sin fin."
      onVolver={onVolver} onGuardar={() => { setConfig(borrador); onVolver(); }}>
      <Lista titulo="Gym" nombre="el gym" orden={gym} todas={SECUENCIA_GYM} onCambiar={setGym} />
      {solapes.length > 0 && (
        <div className="p-4 rounded-2xl flex items-start gap-2.5" style={{ background: 'rgba(245,158,11,0.10)' }}>
          <AlertTriangle size={18} className="text-ambar flex-shrink-0 mt-0.5" />
          <div className="text-sm text-[#f3d9a4] leading-relaxed space-y-1.5">
            {solapes.map(([a, b]) => (
              <p key={a + b}>
                <b className="text-ambar">{SESION_INFO[b].label}</b> va justo después de {SESION_INFO[a].label} y trabajan lo mismo.
                Cuando toque, la app saltará {SESION_INFO[b].label} para no repetir la zona dos sesiones seguidas, así que saldrá menos.
              </p>
            ))}
          </div>
        </div>
      )}
      <Lista titulo="Natación" nombre="la natación" orden={nat} todas={SECUENCIA_NATACION} onCambiar={setNat} />
      <p className="text-sm text-tinta3 leading-relaxed px-1">
        El Test CSS va primero y se repite cada 6-8 semanas en lugar de {sinUmbral ? `${SESION_INFO[nat[0]].label}, porque Umbral no está en la rotación` : 'un Umbral'}.
      </p>
      <Lista titulo="Running" nombre="el running" orden={run} todas={RUNNING_SESIONES} onCambiar={setRun} />
      <p className="text-sm text-tinta3 leading-relaxed px-1">
        El Test 30 min va primero y se repite cada ~12 carreras antes de {sinTempo ? `${SESION_INFO[run[0]].label}, porque Tempo no está en la rotación` : 'un Tempo'}.
      </p>
      <VistaPrevia config={borrador} />
      {!esPlan && (
        <button onClick={() => { setGym([...SECUENCIA_GYM]); setNat([...SECUENCIA_NATACION]); setRun([...SECUENCIA_RUNNING]); }}
          className="w-full h-12 text-[15px] font-medium text-ambar flex items-center justify-center gap-2">
          <RotateCcw size={16} /> Volver al orden del plan
        </button>
      )}
    </Pantalla>
  );
};

export default AjustesRotacion;
