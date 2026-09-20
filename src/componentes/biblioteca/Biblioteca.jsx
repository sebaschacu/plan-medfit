import React, { useMemo } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { SESION_INFO, GRUPOS_SESION } from '../../data.js';
import { COLUMNA } from '../../utiles/constantes-ui.js';
import IconFor from '../comunes/IconFor.jsx';

// ═══════════════ BIBLIOTECA DE RUTINAS ═══════════════
// Consultar qué trae cada sesión sin pasar por el calendario ni tocar nada.
const Biblioteca = ({ onAbrir, onCerrar }) => {
  const porGrupo = useMemo(() => {
    const g = {};
    Object.entries(SESION_INFO).forEach(([k, v]) => {
      if (k === 'natacion') return;          // el tipo genérico no se consulta
      (g[v.grupo] ??= []).push({ k, ...v });
    });
    return g;
  }, []);
  return (
    <div className="min-h-screen bg-[#0f1417]">
      <header className="sticky top-0 z-30 bg-[#0f1417]/95 backdrop-blur border-b border-[#232c34]">
        <div className={`px-4 py-3 ${COLUMNA}`}>
          <button onClick={onCerrar} className="flex items-center gap-1.5 text-slate-400 text-xs font-bold uppercase tracking-wide mb-2">
            <ArrowLeft size={14} /> Calendario
          </button>
          <h1 className="text-xl font-bold text-slate-50 leading-none">Biblioteca de rutinas</h1>
          <p className="text-[11px] text-slate-500 mt-1">Qué trae cada sesión. Solo consulta.</p>
        </div>
      </header>
      <main className={`px-3 py-3 ${COLUMNA} pb-16 space-y-4`}>
        {Object.entries(GRUPOS_SESION).map(([gk, gv]) => {
          const items = porGrupo[gk] ?? [];
          if (!items.length) return null;
          return (
            <div key={gk}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <IconFor name={gv.icon} size={15} color={gv.color} />
                <h2 className="text-[11px] uppercase tracking-wide font-bold" style={{ color: gv.color }}>{gv.label}</h2>
              </div>
              <div className="space-y-1.5">
                {items.map(it => (
                  <button key={it.k} onClick={() => onAbrir(it.k)}
                    className="w-full px-3 py-2.5 rounded-lg border border-[#232c34] bg-[#151b21] flex items-center gap-2.5 text-left">
                    <IconFor name={it.icon} size={16} color={it.color} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold" style={{ color: it.color }}>{it.label}</div>
                      <div className="text-[11px] text-slate-500">{it.tipo}</div>
                    </div>
                    <ChevronRight size={15} className="text-slate-600 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
};

export default Biblioteca;
