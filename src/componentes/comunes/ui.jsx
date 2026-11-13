import React, { useState } from 'react';
import { ChevronDown, Info } from 'lucide-react';
import { TURNO_INFO } from '../../data.js';

// ═══════════════ PIEZAS DEL SISTEMA VISUAL (dirección D) ═══════════════
// Los cuatro patrones que se repiten en toda la app. Cada pantalla los compone;
// ninguno sabe nada del plan.

// Tipo de sesión: cuadrado de 8×8 con su color. El color es el dato.
export const Punto = ({ color, className = '' }) => (
  <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true" className={`flex-shrink-0 ${className}`} style={{ color }}>
    <rect width="8" height="8" rx="2" fill="currentColor" />
  </svg>
);

// Turno: círculo con borde del color del turno y su letra dentro.
export const ChipTurno = ({ turno, conNombre = false, size = 22 }) => {
  const t = TURNO_INFO[turno];
  if (!t) return null;
  const circulo = (
    <span className="inline-flex items-center justify-center rounded-full font-semibold text-tinta flex-shrink-0"
      style={{ width: size, height: size, border: `2px solid ${t.color}`, fontSize: size * 0.5, lineHeight: 1 }}>
      {turno}
    </span>
  );
  if (!conNombre) return circulo;
  return (
    <span className="inline-flex items-center gap-2 h-9 pl-1.5 pr-3 rounded-full bg-elevada text-sm text-tinta2">
      {circulo}{t.label}
    </span>
  );
};

// Texto técnico: plegado a una línea, se abre al tocar. Nada se pierde, pero
// no compite con lo que hay que leer de un vistazo.
export const Detalle = ({ children, resumen, icono, abiertoInicial = false, tono = 'neutro', className = '' }) => {
  const [abierto, setAbierto] = useState(abiertoInicial);
  const ambar = tono === 'ambar';
  return (
    <div className={`rounded-2xl ${ambar ? '' : 'bg-elevada'} ${className}`}
      style={ambar ? { background: 'rgba(245,158,11,0.10)' } : undefined}>
      <button onClick={() => setAbierto(a => !a)} aria-expanded={abierto}
        className="w-full min-h-[44px] px-3.5 py-2.5 flex items-center gap-2.5 text-left">
        <span className={`flex-shrink-0 ${ambar ? 'text-ambar' : 'text-tinta3'}`}>{icono ?? <Info size={18} />}</span>
        <span className={`flex-1 min-w-0 text-sm ${abierto ? '' : 'truncate'} ${ambar ? 'text-ambar font-medium' : 'text-tinta2'}`}>
          {resumen ?? (abierto ? null : children)}
        </span>
        <ChevronDown size={18} className={`flex-shrink-0 text-tinta3 transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>
      {abierto && <div className={`px-3.5 pb-3 -mt-1 text-sm leading-relaxed ${ambar ? 'text-[#f3d9a4]' : 'text-tinta2'}`}>{children}</div>}
    </div>
  );
};

// Botón principal: 60 px, del color de la sesión, texto oscuro.
export const BotonCTA = ({ color = '#e8edf0', children, className = '', ...props }) => (
  <button {...props}
    className={`w-full h-[60px] rounded-[18px] px-5 flex items-center justify-center gap-2.5 text-lg font-semibold text-[#0d1215] disabled:opacity-40 ${className}`}
    style={{ background: color }}>
    {children}
  </button>
);

// Barra segmentada: dos o tres opciones excluyentes.
export const Segmentado = ({ opciones, valor, onCambiar, etiqueta }) => (
  <div role="tablist" aria-label={etiqueta} className="flex p-1 rounded-2xl bg-tarjeta">
    {opciones.map(([k, label]) => (
      <button key={k} role="tab" aria-selected={valor === k} onClick={() => onCambiar(k)}
        className={`flex-1 h-11 rounded-xl text-[15px] font-semibold ${valor === k ? 'bg-elevada text-tinta' : 'text-tinta3'}`}>
        {label}
      </button>
    ))}
  </div>
);

// Hoja que sube desde abajo. Tocar fuera la cierra.
export const Hoja = ({ onCerrar, etiqueta, children }) => (
  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75" onClick={onCerrar}>
    <div role="dialog" aria-modal="true" aria-label={etiqueta}
      className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-tarjeta rounded-t-[28px] sm:rounded-[28px] pb-[env(safe-area-inset-bottom)]"
      onClick={e => e.stopPropagation()}>
      <div className="mx-auto mt-2.5 mb-1 h-1 w-10 rounded-full bg-borde sm:hidden" aria-hidden="true" />
      {children}
    </div>
  </div>
);
