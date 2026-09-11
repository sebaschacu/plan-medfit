import React from 'react';

// Declarado a nivel de módulo a propósito: definirlo dentro del render crea un
// COMPONENTE NUEVO en cada pasada, así que React desmonta y remonta el árbol y
// se pierde el estado y el foco. Es el aviso static-components del linter.
const BotonSiNo = ({ activo, onClick, children }) => (
  <button onClick={onClick}
    className={`flex-1 py-1.5 rounded-md border text-[11px] font-bold transition-all ${
      activo ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300' : 'border-[#2a3540] text-slate-400'}`}>
    {children}
  </button>
);

export default BotonSiNo;
