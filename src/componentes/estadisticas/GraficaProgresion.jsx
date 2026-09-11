import React, { useState, useMemo } from 'react';
import { SESIONES } from '../../data.js';
import { historialEjercicio } from '../../reglas.js';
import { useProgresoCtx } from '../../estado/contextos.js';

// ═══════════════ GRÁFICA DE PROGRESIÓN ═══════════════
// SVG a mano: una línea con puntos no justifica añadir una librería al bundle.
const GraficaProgresion = () => {
  const { progress, prMap } = useProgresoCtx();
  const [modo, setModo] = useState('carga');     // carga | volumen
  // Los compuestos de Parte 1 van primero: son los que llevan progresión lineal
  const candidatos = useMemo(() => {
    const vistos = new Map();
    Object.values(SESIONES).forEach(ses => (ses.ejercicios ?? []).forEach(ex => {
      if (!vistos.has(ex.id)) vistos.set(ex.id, ex);
    }));
    const conDatos = [...vistos.values()].filter(ex => historialEjercicio(progress, ex.id).length >= 2);
    return conDatos.sort((a, b) => (b.lineal ? 1 : 0) - (a.lineal ? 1 : 0) || a.nombre.localeCompare(b.nombre));
  }, [progress]);

  const [exId, setExId] = useState(null);
  const actual = candidatos.find(e => e.id === exId) ?? candidatos[0];
  const serie = useMemo(() => actual ? historialEjercicio(progress, actual.id) : [], [progress, actual]);

  if (!candidatos.length) {
    return (
      <div className="rounded-xl border border-[#232c34] bg-[#151b21] p-3.5 mt-2.5">
        <div className="text-[10px] uppercase tracking-wide text-slate-500 font-bold mb-2">Progresión por ejercicio</div>
        <p className="text-[11px] text-slate-600 leading-relaxed">
          Aún no hay dos sesiones registradas de ningún ejercicio. La curva aparece en cuanto repitas uno.
        </p>
      </div>
    );
  }

  const valores = serie.map(s => modo === 'carga' ? s.kgMax : s.volumen);
  const max = Math.max(...valores, 1);
  const min = Math.min(...valores, 0);
  const rango = max - min || 1;
  const W = 300, H = 110, PX = 6, PY = 10;
  const px = (i) => PX + (i / Math.max(1, serie.length - 1)) * (W - PX * 2);
  const py = (v) => H - PY - ((v - min) / rango) * (H - PY * 2);
  const puntos = valores.map((v, i) => `${px(i)},${py(v)}`).join(' ');
  const prKg = prMap?.[actual.id]?.kg;

  return (
    <div className="rounded-xl border border-[#232c34] bg-[#151b21] p-3.5 mt-2.5">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">Progresión por ejercicio</div>
        <div className="flex gap-1">
          {[['carga', 'Carga'], ['volumen', 'Volumen']].map(([k, l]) => (
            <button key={k} onClick={() => setModo(k)}
              className={`text-[9px] font-bold uppercase px-2 py-1 rounded border ${modo === k ? 'border-emerald-600 bg-emerald-950/30 text-emerald-300' : 'border-[#232c34] text-slate-500'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <select value={actual.id} onChange={e => setExId(e.target.value)} aria-label="Ejercicio a graficar"
        className="w-full h-8 px-2 mb-2 bg-[#0f1417] border border-[#2a3540] text-slate-200 text-xs rounded">
        {candidatos.map(e => (
          <option key={e.id} value={e.id}>{e.lineal ? '★ ' : ''}{e.nombre}</option>
        ))}
      </select>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 110 }} role="img"
        aria-label={`Progresión de ${actual.nombre}`}>
        <line x1={PX} y1={H - PY} x2={W - PX} y2={H - PY} stroke="#232c34" strokeWidth="1" />
        <polyline points={puntos} fill="none" stroke="#22c55e" strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round" />
        {serie.map((s, i) => {
          const v = valores[i];
          const esPR = modo === 'carga' && prKg != null && s.kgMax >= prKg;
          // Un reset del 10% se ve como una caída marcada respecto a la anterior
          const esReset = i > 0 && modo === 'carga' && valores[i] < valores[i - 1] * 0.95;
          return (
            <g key={s.fecha}>
              <circle cx={px(i)} cy={py(v)} r={esPR ? 4.5 : 3}
                fill={esReset ? '#fb923c' : esPR ? '#fbbf24' : '#22c55e'} />
              {esPR && <circle cx={px(i)} cy={py(v)} r="7" fill="none" stroke="#fbbf24" strokeWidth="1" opacity="0.5" />}
            </g>
          );
        })}
      </svg>

      <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
        <span>{serie[0]?.fecha.slice(5)}</span>
        <span style={{ fontFamily: 'ui-monospace, monospace' }}>
          {valores[0]} → <span className="text-slate-300 font-bold">{valores.at(-1)}</span>
          {modo === 'carga' ? ' kg' : ' kg·rep'}
        </span>
        <span>{serie.at(-1)?.fecha.slice(5)}</span>
      </div>
      <div className="flex items-center gap-3 mt-2 text-[9px] text-slate-600">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#fbbf24' }} /> PR</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#fb923c' }} /> reset del 10%</span>
        <span>★ = progresión lineal</span>
      </div>
    </div>
  );
};

export default GraficaProgresion;
