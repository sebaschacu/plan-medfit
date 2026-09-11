import React from 'react';

// ═══════════════ NUMERIC INPUT ═══════════════
const NumInput = ({ value, onChange, placeholder, w = 'w-11', etiqueta }) => (
  <input
    type="text" inputMode="numeric" pattern="[0-9]*\.?[0-9]*"
    value={value ?? ''}
    onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.'))}
    placeholder={placeholder}
    aria-label={etiqueta ?? placeholder}
    className={`${w} h-8 px-1 bg-[#0f1417] border border-[#2a3540] focus:border-[#4a5560] focus:outline-none text-slate-100 text-xs text-center rounded transition-colors`}
    style={{ fontFamily: 'ui-monospace, monospace' }}
  />
);

export default NumInput;
