import React, { useState, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { SESION_INFO, GRUPOS_SESION } from '../../data.js';
import { Punto } from '../comunes/ui.jsx';

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
    <div className="space-y-2">
      {Object.entries(GRUPOS_SESION).map(([gk, gv]) => {
        const items = porGrupo[gk] ?? [];
        if (!items.length) return null;
        const desplegado = abierto === gk;
        const contieneActual = items.some(i => i.k === sesion);
        return (
          <div key={gk} className="rounded-2xl bg-elevada">
            <button onClick={() => setAbierto(desplegado ? null : gk)}
              aria-label={`Categoría ${gv.label}`} aria-expanded={desplegado}
              className="w-full min-h-[52px] px-4 flex items-center gap-3 text-left">
              <Punto color={gv.color} />
              <span className="text-[17px] font-medium text-tinta flex-1">{gv.label}</span>
              {contieneActual && !desplegado && (
                <span className="text-[15px] text-tinta2">{SESION_INFO[sesion].label}</span>
              )}
              <ChevronDown size={20} className={`text-tinta3 transition-transform ${desplegado ? 'rotate-180' : ''}`} />
            </button>
            {desplegado && (
              <div className="grid grid-cols-2 gap-2 px-2 pb-2">
                {items.map(v => {
                  const on = sesion === v.k;
                  return (
                    <button key={v.k} onClick={() => onElegir(v.k)}
                      aria-label={`Elegir ${v.label}`} aria-pressed={on}
                      className={`min-h-[60px] py-2 px-3 rounded-xl text-left ${on ? '' : 'bg-fondo'}`}
                      style={on ? { background: v.color + '26', boxShadow: `inset 0 0 0 2px ${v.color}` } : undefined}>
                      <div className="flex items-center gap-2 text-[15px] font-semibold text-tinta"><Punto color={v.color} />{v.label}</div>
                      <div className="text-sm text-tinta3 leading-tight mt-0.5">{v.tipo}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MenuSesiones;
