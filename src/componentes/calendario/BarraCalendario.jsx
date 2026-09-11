import React from 'react';
import { ChevronLeft, ChevronRight, Check, Activity, Settings, ArrowLeft } from 'lucide-react';

// Cabecera del calendario: navegación de mes, estado de guardado, acceso a la
// biblioteca y el modo edición con su panel de exportar/importar.
const BarraCalendario = ({ mesInfo, onMes, hayMesAnterior, saveStatus, onBiblioteca,
  editMode, setEditMode, onExportar, onImportar, mensajeDatos }) => (
  <header className="sticky top-0 z-30 bg-[#0f1417]/95 backdrop-blur border-b border-[#232c34]">
    <div className="px-4 py-4 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <button onClick={() => onMes(-1)} aria-label="Mes anterior" disabled={!hayMesAnterior}
            className="w-7 h-7 rounded-lg border border-[#2a3540] text-slate-400 disabled:text-slate-700 disabled:border-[#1c242b] flex items-center justify-center flex-shrink-0">
            <ChevronLeft size={15} />
          </button>
          <h1 className="text-xl font-bold text-slate-50 leading-none tracking-tight truncate">{mesInfo.nombre} {mesInfo.anio}</h1>
          <button onClick={() => onMes(1)} aria-label="Mes siguiente"
            className="w-7 h-7 rounded-lg border border-[#2a3540] text-slate-400 flex items-center justify-center flex-shrink-0">
            <ChevronRight size={15} />
          </button>
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Generado desde tu rota · v6</p>
          {saveStatus === 'saved' && (
            <span className="text-[10px] uppercase tracking-wide text-emerald-400 font-bold flex items-center gap-0.5">
              <Check size={10} strokeWidth={3} /> Guardado
            </span>
          )}
        </div>
      </div>
      <button onClick={onBiblioteca} aria-label="Biblioteca de rutinas"
        className="w-10 h-10 rounded-lg border border-[#2a3540] text-slate-400 flex items-center justify-center flex-shrink-0">
        <Activity size={18} />
      </button>
      <button onClick={() => setEditMode(!editMode)}
        aria-label="Modo edición" aria-pressed={editMode}
        className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-all flex-shrink-0 ${editMode ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400' : 'border-[#2a3540] text-slate-400'}`}>
        <Settings size={18} />
      </button>
    </div>
    {editMode && (
      <div className="px-4 pb-3 space-y-2">
        <div className="px-3 py-2 rounded-lg bg-emerald-950/30 border border-emerald-800/40">
          <p className="text-[11px] text-emerald-300">
            Modo edición: toca un día para cambiar su turno o su sesión. El día queda <span className="font-bold">fijado</span> y el resto del calendario se recalcula respetándolo — la cola de gym se resincroniza sola.
          </p>
        </div>
        {/* Exportar / importar: sincroniza PC ↔ teléfono sin montar backend */}
        <div className="px-3 py-2.5 rounded-lg bg-[#151b21] border border-[#232c34]">
          <div className="text-[10px] uppercase tracking-wide text-slate-500 font-bold mb-2">Datos · sincronizar PC ↔ teléfono</div>
          <div className="flex gap-2">
            <button onClick={onExportar}
              className="flex-1 py-2 rounded-lg border border-[#2a3540] text-slate-300 text-[11px] font-bold uppercase flex items-center justify-center gap-1.5">
              <ArrowLeft size={12} className="rotate-90" /> Exportar
            </button>
            <label className="flex-1 py-2 rounded-lg border border-[#2a3540] text-slate-300 text-[11px] font-bold uppercase flex items-center justify-center gap-1.5 cursor-pointer">
              <ArrowLeft size={12} className="-rotate-90" /> Importar
              <input type="file" accept="application/json,.json" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportar(f); e.target.value = ''; }} />
            </label>
          </div>
          <p className="text-[9px] text-slate-600 mt-2 leading-relaxed">
            Exporta tu progreso, cargas, PRs, días fijados, rutinas editadas, test CSS y complementos. Importar <span className="font-bold">reemplaza</span> todo eso en este dispositivo.
          </p>
          {mensajeDatos && (
            <p className={`text-[10px] mt-1.5 font-bold ${mensajeDatos.ok ? 'text-emerald-400' : 'text-red-400'}`}>{mensajeDatos.texto}</p>
          )}
        </div>
      </div>
    )}
  </header>
);

export default BarraCalendario;
