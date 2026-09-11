import React from 'react';
import { Timer, X } from 'lucide-react';
import { fmtTime } from '../../utiles/formato.js';

// ═══════════════ REST TIMER OVERLAY ═══════════════
const RestTimer = ({ timer, onSkip, color }) => {
  if (!timer) return null;
  const { secondsLeft, total, name, done } = timer;
  const pct = total > 0 ? Math.max(0, (secondsLeft / total) * 100) : 0;
  const low = secondsLeft <= 5 && secondsLeft > 0;
  return (
    <div className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-6 sm:w-72 z-50 rounded-xl overflow-hidden border-2 shadow-2xl"
      style={{ borderColor: done ? '#22c55e' : color, background: '#151b21' }}>
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <Timer size={13} color={done ? '#22c55e' : color} />
            <span className="text-[10px] uppercase tracking-wide font-bold truncate" style={{ color: done ? '#22c55e' : color }}>
              {done ? 'Descanso listo' : 'Descansando'}
            </span>
          </div>
          <button onClick={onSkip} className="flex items-center gap-1 px-2 py-0.5 border border-[#2a3540] rounded text-slate-400 text-[10px] font-bold">
            SALTAR <X size={10} />
          </button>
        </div>
        <div className="text-[10px] text-slate-500 truncate mb-1">{name}</div>
        <div className={`text-4xl font-bold leading-none ${low ? 'text-red-400' : 'text-slate-100'}`} style={{ fontFamily: 'ui-monospace, monospace' }}>
          {fmtTime(secondsLeft)}
        </div>
        <div className="mt-2 h-1 bg-[#0f1417] rounded-full overflow-hidden">
          <div className="h-full transition-all duration-1000 ease-linear" style={{ width: `${pct}%`, background: done ? '#22c55e' : color }} />
        </div>
      </div>
    </div>
  );
};

export default RestTimer;
