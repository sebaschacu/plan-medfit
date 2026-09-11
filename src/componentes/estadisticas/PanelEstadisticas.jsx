import React from 'react';
import { TrendingUp, Flame } from 'lucide-react';
import VolumenMuscular from './VolumenMuscular.jsx';
import GraficaProgresion from './GraficaProgresion.jsx';

// ═══ PANEL DE ESTADÍSTICAS ═══
// `stats` lo calcula CalendarView, que es quien tiene dayCompletion: la misma
// función que decide el check de cada celda decide también estos números.
// Lo demás lo lee cada panel del contexto.
const PanelEstadisticas = ({ stats }) => (
  <div className="mt-6">
    <div className="flex items-center gap-2 mb-3 px-1">
      <TrendingUp size={15} className="text-emerald-400" />
      <h2 className="text-[11px] uppercase tracking-wide text-slate-400 font-bold">Tu progreso este mes</h2>
    </div>

    {/* Fila superior: anillo de sesiones + racha */}
    <div className="grid grid-cols-2 gap-2.5 mb-2.5">
      {/* Anillo de progreso */}
      <div className="rounded-xl border border-[#232c34] bg-[#151b21] p-3 flex items-center gap-3">
        <div className="relative flex-shrink-0" style={{ width: 62, height: 62 }}>
          <svg width="62" height="62" className="-rotate-90">
            <circle cx="31" cy="31" r="26" fill="none" stroke="#232c34" strokeWidth="6" />
            <circle cx="31" cy="31" r="26" fill="none" stroke="#22c55e" strokeWidth="6" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 26}
              strokeDashoffset={2 * Math.PI * 26 * (1 - stats.pct / 100)}
              style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-base font-bold text-slate-100" style={{ fontFamily: 'ui-monospace, monospace' }}>{stats.pct}%</span>
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-bold text-slate-100 leading-none" style={{ fontFamily: 'ui-monospace, monospace' }}>
            {stats.completadas}<span className="text-sm text-slate-500">/{stats.totalEntrenables}</span>
          </div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500 mt-1 leading-tight">Sesiones<br />completadas</div>
        </div>
      </div>

      {/* Racha */}
      <div className="rounded-xl border border-[#232c34] bg-[#151b21] p-3 flex items-center gap-3">
        <div className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: stats.racha > 0 ? 'radial-gradient(circle, #f59e0b33, #f59e0b11)' : '#1a222a' }}>
          <Flame size={30} color={stats.racha > 0 ? '#f59e0b' : '#475569'} fill={stats.racha > 0 ? '#f59e0b' : 'none'} fillOpacity={0.25} />
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-bold text-slate-100 leading-none" style={{ fontFamily: 'ui-monospace, monospace' }}>
            {stats.racha}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500 mt-1 leading-tight">
            {stats.racha === 1 ? 'Sesión en' : 'Sesiones en'}<br />racha
          </div>
        </div>
      </div>
    </div>

    {/* Desglose por categoría (barras sutiles) */}
    <div className="rounded-xl border border-[#232c34] bg-[#151b21] p-3.5">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 font-bold mb-3">Desglose por tipo</div>
      <div className="space-y-2.5">
        {[
          { key: 'gym', label: 'Gimnasio', color: '#22c55e' },
          { key: 'cardio', label: 'Cardio', color: '#06b6d4' },
          { key: 'calistenia', label: 'Calistenia', color: '#a855f7' },
        ].map(({ key, label, color }) => {
          const done = stats.cats[key], tot = stats.catsTotal[key];
          const pct = tot > 0 ? (done / tot) * 100 : 0;
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-slate-300">{label}</span>
                <span className="text-[10px] font-bold" style={{ fontFamily: 'ui-monospace, monospace', color }}>{done}/{tot}</span>
              </div>
              <div className="h-1.5 bg-[#0f1417] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, transition: 'width 0.6s ease' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>

    {/* Volumen por grupo muscular (v6 · 7.2) */}
    <VolumenMuscular />
    <GraficaProgresion />
  </div>
);

export default PanelEstadisticas;
