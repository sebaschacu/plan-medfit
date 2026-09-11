import React, { useState } from 'react';
import { X, Star, AlertTriangle, RotateCcw } from 'lucide-react';
import { TURNO_INFO, SESION_INFO } from '../../data.js';
import { useProgresoCtx } from '../../estado/contextos.js';
import MenuSesiones from './MenuSesiones.jsx';

// ═══════════════ EDIT DAY MODAL ═══════════════
// `dia`, onSave, onLiberar y onClose vienen de App: el modal es un flag de
// pantalla y cerrarlo es cosa del enrutador. El progreso lo lee de aquí.
const EditModal = ({ dia, onSave, onLiberar, onClose }) => {
  const { progress } = useProgresoCtx();
  // Las horas de sueño (__sueno) no son un ejercicio: no cuentan como registro.
  const ejerciciosRegistrados = Object.keys(progress[dia.fecha] || {}).filter(k => !k.startsWith('__')).length;
  const [turno, setTurno] = useState(dia.turno);
  const [sesion, setSesion] = useState(dia.sesion);
  const [festivo, setFestivo] = useState(!!dia.festivo);
  const [asumido, setAsumido] = useState(false);

  // Cambiar de sesión un día que ya tiene entrenamiento registrado dejaría ese
  // registro apuntando a ejercicios de otra sesión. Se avisa y se exige confirmar.
  const cambiaSesion = sesion !== dia.sesion;
  const destruye = cambiaSesion && ejerciciosRegistrados > 0;
  const bloqueado = destruye && !asumido;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 bg-black/80" onClick={onClose}>
      <div className="w-full max-w-md bg-[#151b21] border border-[#2a3540] rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-[#232c34] flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-100">Editar día {dia.dia} · {dia.sem}</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">Se fija este día y se recalcula lo que viene después</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-slate-400"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500 font-bold mb-2">Turno</div>
            <div className="grid grid-cols-4 gap-1.5">
              {Object.entries(TURNO_INFO).map(([k, v]) => (
                <button key={k} onClick={() => setTurno(k)}
                  className={`py-2 rounded-lg border-2 text-xs font-bold transition-all ${turno === k ? '' : 'border-[#2a3540] text-slate-400'}`}
                  style={{ borderColor: turno === k ? v.color : undefined, background: turno === k ? v.color + '22' : undefined, color: turno === k ? v.color : undefined }}>
                  {k}
                  <div className="text-[8px] font-normal mt-0.5">{v.label}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500 font-bold mb-2">Sesión</div>
            <MenuSesiones sesion={sesion} onElegir={setSesion} />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500 font-bold mb-2">Festivo</div>
            <button onClick={() => setFestivo(!festivo)}
              className={`w-full py-2.5 rounded-lg border-2 text-xs font-bold flex items-center justify-center gap-2 transition-all ${festivo ? 'border-rose-500 bg-rose-500/20 text-rose-300' : 'border-[#2a3540] text-slate-400'}`}>
              <Star size={14} fill={festivo ? 'currentColor' : 'none'} />
              {festivo ? 'Es festivo (piscina cerrada)' : 'Marcar como festivo'}
            </button>
          </div>
        </div>
        <div className="p-4 pt-0 flex flex-col gap-2">
          {/* Aviso: este día ya tiene entrenamiento registrado */}
          {destruye && (
            <div className="px-3 py-2.5 rounded-lg border-l-4 border-red-500 bg-red-950/25">
              <div className="flex items-start gap-2">
                <AlertTriangle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
                <div className="text-[11px] text-red-100 leading-relaxed">
                  <span className="font-bold">Este día ya tiene entrenamiento registrado</span> ({ejerciciosRegistrados}{' '}
                  {ejerciciosRegistrados === 1 ? 'ejercicio' : 'ejercicios'}). Cambiarlo de {SESION_INFO[dia.sesion]?.label} a {SESION_INFO[sesion]?.label} dejaría
                  ese registro apuntando a ejercicios que no existen en la sesión nueva, así que <span className="font-bold">se borrará</span>.
                  Tus PRs históricos no se tocan.
                </div>
              </div>
              <label className="flex items-center gap-2 mt-2.5 cursor-pointer">
                <input type="checkbox" checked={asumido} onChange={(e) => setAsumido(e.target.checked)}
                  className="w-4 h-4 accent-red-500 flex-shrink-0" />
                <span className="text-[11px] font-bold text-red-200">Entiendo, borra el registro de este día</span>
              </label>
            </div>
          )}
          {dia.fijado && !dia.fijadoAuto && (
            <button onClick={() => onLiberar(dia.fecha)}
              className="w-full py-2 border border-amber-700/50 bg-amber-950/20 text-amber-300 text-[11px] font-bold uppercase rounded-lg flex items-center justify-center gap-1.5">
              <RotateCcw size={12} /> Soltar este día y dejar que lo genere
            </button>
          )}
          {dia.fijadoAuto && !destruye && (
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Este día quedó fijado solo porque tiene entrenamiento registrado. El generador no lo moverá.
            </p>
          )}
        </div>
        <div className="flex gap-2 p-4 border-t border-[#232c34]">
          <button onClick={onClose} className="flex-1 py-2.5 border border-[#2a3540] text-slate-300 text-xs font-bold uppercase rounded-lg">Cancelar</button>
          <button onClick={() => onSave(dia.fecha, turno, sesion, festivo, destruye)} disabled={bloqueado}
            className={`flex-1 py-2.5 text-white text-xs font-bold uppercase rounded-lg ${
              bloqueado ? 'bg-slate-700 text-slate-500' : destruye ? 'bg-red-600' : 'bg-emerald-600'}`}>
            {destruye ? 'Cambiar y borrar' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditModal;
