import React from 'react';

// Declarado a nivel de módulo a propósito: definirlo dentro del render crea un
// COMPONENTE NUEVO en cada pasada, así que React desmonta y remonta el árbol y
// se pierde el estado y el foco. Es el aviso static-components del linter.
const BotonSiNo = ({ activo, onClick, children }) => (
  <button onClick={onClick} aria-pressed={!!activo}
    className={`flex-1 h-12 rounded-2xl text-base font-semibold ${
      activo ? 'bg-emerald-500/20 text-emerald-300 ring-2 ring-emerald-500' : 'bg-elevada text-tinta2'}`}>
    {children}
  </button>
);

export default BotonSiNo;
