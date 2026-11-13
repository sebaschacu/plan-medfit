import React from 'react';

// ═══════════════ NUMERIC INPUT ═══════════════
// 44 px de alto: se toca con el pulgar, de pie.
const NumInput = ({ value, onChange, placeholder, w = 'w-16', etiqueta, grande = false }) => (
  <input
    type="text" inputMode="decimal" pattern="[0-9]*\.?[0-9]*"
    value={value ?? ''}
    onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.'))}
    placeholder={placeholder}
    aria-label={etiqueta ?? placeholder}
    className={`${w} ${grande ? 'h-14 text-2xl font-semibold' : 'h-11 text-base'} px-1 bg-fondo border border-borde focus:border-tinta3 focus:outline-none text-tinta text-center rounded-xl placeholder:text-mudo`}
  />
);

export default NumInput;
