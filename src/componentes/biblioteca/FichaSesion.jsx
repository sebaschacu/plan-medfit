import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { SESIONES, SESION_INFO } from '../../data.js';
import IconFor from '../comunes/IconFor.jsx';
import FichaEjercicio from '../comunes/FichaEjercicio.jsx';

// ═══════════════ FICHA DE SESIÓN (solo lectura) ═══════════════
const FichaSesion = ({ sesionKey, ejercicios, onCerrar }) => {
  const ses = SESIONES[sesionKey];
  const info = SESION_INFO[sesionKey];
  if (!ses) return null;
  const lista = ejercicios ?? ses.ejercicios;
  const series = lista.filter(e => !e.opcional).reduce((a, e) => a + (typeof e.series === 'number' ? e.series : 0), 0);
  return (
    <div className="min-h-screen bg-[#0f1417]">
      <header className="sticky top-0 z-30 bg-[#0f1417]/95 backdrop-blur border-b border-[#232c34] px-4 py-3">
        <button onClick={onCerrar} className="flex items-center gap-1.5 text-slate-400 text-xs font-bold uppercase tracking-wide mb-2">
          <ArrowLeft size={14} /> Volver
        </button>
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: info.color + '22', border: `1.5px solid ${info.color}` }}>
            <IconFor name={info.icon} size={20} color={info.color} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-slate-50 leading-tight">{ses.nombre}</h1>
            <p className="text-[11px] uppercase tracking-wide mt-0.5" style={{ color: info.color }}>
              {info.tipo} · {ses.duracion}{lista.length ? ` · ${series} series` : ''}
            </p>
          </div>
        </div>
        <p className="text-[10px] text-slate-600 mt-2">Solo consulta · esto no cambia tu calendario</p>
      </header>
      <main className="px-3 py-3 max-w-2xl mx-auto pb-16 space-y-2">
        {ses.chequeo && (
          <div className="px-3 py-2.5 rounded-lg border-l-4 bg-[#151b21] mb-1" style={{ borderColor: info.color }}>
            <p className="text-[12px] text-slate-300 leading-relaxed">{ses.chequeo}</p>
          </div>
        )}
        {ses.recortada && (
          <div className="px-3 py-2 rounded-lg border border-[#232c34] bg-[#151b21] mb-1">
            <div className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">Versión recortada (45 min)</div>
            <p className="text-[11px] text-slate-400 mt-0.5">{ses.recortada}</p>
          </div>
        )}
        {lista.length === 0
          ? <p className="text-[12px] text-slate-500 py-6 text-center">Día de recuperación: sin ejercicios.</p>
          : lista.map(ex => <FichaEjercicio key={ex.id} ex={ex} />)}
      </main>
    </div>
  );
};

export default FichaSesion;
