import React from 'react';
import { fmtTime } from '../../utiles/formato.js';

// ═══════════════ DESCANSO · barra inferior ═══════════════
// Aparece sola al dar una serie por hecha. Lo único grande es el tiempo.
// «Corregir» abre la rueda sobre la serie recién guardada.
const RestTimer = ({ timer, onSkip, color, guardada, onCorregir }) => {
  if (!timer) return null;
  const { secondsLeft, total, name, done } = timer;
  const pct = total > 0 ? Math.max(0, (secondsLeft / total) * 100) : 0;
  const low = secondsLeft <= 5 && secondsLeft > 0;
  return (
    <div className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-40 rounded-3xl bg-elevada px-5 pt-3.5 pb-4 mb-[env(safe-area-inset-bottom)]"
      role="timer" aria-label="Descanso">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="rotulo" style={done ? { color: '#4ade80' } : undefined}>{done ? 'Descanso listo' : 'Descansando'}</div>
          <div className={`text-[40px] font-semibold leading-none mt-0.5 ${low ? 'text-ambar' : 'text-tinta'}`}>{fmtTime(secondsLeft)}</div>
        </div>
        {onCorregir && (
          <button onClick={onCorregir} className="h-12 px-3 text-base font-semibold text-tinta">Corregir</button>
        )}
        <button onClick={onSkip} className="h-12 px-5 rounded-2xl bg-tinta text-[#0d1215] text-base font-semibold">Saltar</button>
      </div>
      <div className="mt-3 h-1.5 bg-fondo rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-1000 ease-linear" style={{ width: `${pct}%`, background: done ? '#4ade80' : color }} />
      </div>
      <div className="mt-2 text-sm text-tinta3 truncate">{name}{guardada ? ` · ${guardada}` : ''}</div>
    </div>
  );
};

export default RestTimer;
