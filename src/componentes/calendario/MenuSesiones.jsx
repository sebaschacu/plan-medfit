import React, { useState, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { SESION_INFO, GRUPOS_SESION } from '../../data.js';
import IconFor from '../comunes/IconFor.jsx';

// ═══════════════ MENÚ DE SESIONES AGRUPADO ═══════════════
// 16 opciones sueltas cuestan de leer. Se agrupan por el campo `grupo` de
// SESION_INFO — no por una lista escrita aquí, que se quedaría desfasada.
// Arranca desplegada la categoría de lo que ese día ya tenía.
const MenuSesiones = ({ sesion, onElegir }) => {
  const porGrupo = useMemo(() => {
    const g = {};
    Object.entries(SESION_INFO).forEach(([k, v]) => {
      if (k === 'natacion') return;   // el tipo genérico no se elige a mano
      (g[v.grupo] ??= []).push({ k, ...v });
    });
    return g;
  }, []);
  const grupoActual = SESION_INFO[sesion]?.grupo ?? 'gym';
  const [abierto, setAbierto] = useState(grupoActual);

  return (
    <div className="space-y-1.5">
      {Object.entries(GRUPOS_SESION).map(([gk, gv]) => {
        const items = porGrupo[gk] ?? [];
        if (!items.length) return null;
        const desplegado = abierto === gk;
        const contieneActual = items.some(i => i.k === sesion);
        return (
          <div key={gk} className="rounded-lg border border-[#2a3540] overflow-hidden">
            <button onClick={() => setAbierto(desplegado ? null : gk)}
              aria-label={`Categoría ${gv.label}`} aria-expanded={desplegado}
              className="w-full px-2.5 py-2 flex items-center gap-2 text-left">
              <IconFor name={gv.icon} size={15} color={gv.color} />
              <span className="text-xs font-bold flex-1" style={{ color: contieneActual ? gv.color : '#94a3b8' }}>
                {gv.label}
              </span>
              {contieneActual && !desplegado && (
                <span className="text-[10px] text-slate-400">{SESION_INFO[sesion].label}</span>
              )}
              <ChevronRight size={14} className={`text-slate-500 transition-transform ${desplegado ? 'rotate-90' : ''}`} />
            </button>
            {desplegado && (
              <div className="grid grid-cols-2 gap-1.5 p-2 pt-0">
                {items.map(v => (
                  <button key={v.k} onClick={() => onElegir(v.k)}
                    aria-label={`Elegir ${v.label}`} aria-pressed={sesion === v.k}
                    className={`py-2 px-2 rounded-lg border-2 text-left transition-all ${sesion === v.k ? '' : 'border-[#2a3540]'}`}
                    style={sesion === v.k ? { borderColor: v.color, background: v.color + '22' } : undefined}>
                    <div className="text-xs font-bold" style={{ color: sesion === v.k ? v.color : '#cbd5e1' }}>{v.label}</div>
                    <div className="text-[10px] text-slate-500 leading-tight">{v.tipo}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MenuSesiones;
