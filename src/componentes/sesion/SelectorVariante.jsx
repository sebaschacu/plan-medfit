import React, { useState } from 'react';
import { ChevronRight, AlertTriangle, RotateCcw } from 'lucide-react';
import { SESION_INFO, SECUENCIA_NATACION, SECUENCIA_GYM } from '../../data.js';

// ═══════════════ SELECTOR DE VARIANTE DENTRO DEL DÍA ═══════════════
// El tipo (gym / natación) se elige en configuración; CUÁL de la cola toca se ve
// y se cambia aquí. Fijar una a mano no adelanta la cola: la que tocaba se hace
// en la siguiente sesión (ver POLITICA_FIJADO en generador.js).
const SelectorVariante = ({ dia, secundaria = false, onFijar, onSoltar, registrados = 0 }) => {
  const [abierto, setAbierto] = useState(false);
  const [porConfirmar, setPorConfirmar] = useState(null);   // clave elegida pendiente de confirmar
  const esNat = (secundaria ? dia.sesionSecundaria : dia.sesion) === 'natacion';
  const esGym = String(secundaria ? dia.sesionSecundaria : dia.sesion).startsWith('gym');
  if (!esNat && !esGym) return null;

  const opciones = esNat ? [...SECUENCIA_NATACION, 'natCSS'] : SECUENCIA_GYM;
  const actual = esNat
    ? (secundaria ? dia.varianteSecundaria : dia.variante)
    : (secundaria ? dia.sesionSecundaria : dia.sesion);
  const fijadaPorMi = esNat
    ? !!(secundaria ? dia.varianteFijadaSecundaria : dia.varianteFijada)
    : !!dia.fijado && !dia.fijadoAuto;
  const sugerida = esNat ? (secundaria ? dia.sugeridaSecundaria : dia.sugerida) : dia.sugeridaGym;

  return (
    <div className="mb-3 rounded-lg border border-[#232c34] bg-[#151b21]">
      <button onClick={() => setAbierto(!abierto)} className="w-full px-3 py-2.5 flex items-center gap-2 text-left">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">
            {secundaria ? 'Segunda sesión' : 'Sesión de hoy'}
          </div>
          <div className="text-sm font-bold" style={{ color: SESION_INFO[actual]?.color }}>
            {SESION_INFO[actual]?.label}
            <span className="text-[11px] font-normal text-slate-500"> · {SESION_INFO[actual]?.tipo}</span>
          </div>
        </div>
        {fijadaPorMi && (
          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border border-amber-700/60 bg-amber-950/30 text-amber-300 flex-shrink-0">
            elegida
          </span>
        )}
        <ChevronRight size={15} className={`text-slate-500 flex-shrink-0 transition-transform ${abierto ? 'rotate-90' : ''}`} />
      </button>

      {abierto && (
        <div className="px-3 pb-3 space-y-2">
          {/* Misma protección que el modal de edición: cambiar de sesión un día
              con entrenamiento registrado dejaría ese registro apuntando a
              ejercicios de otra sesión. Se avisa y se exige confirmar. */}
          {porConfirmar && (
            <div className="px-2.5 py-2 rounded-lg border-l-4 border-red-500 bg-red-950/25">
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-red-100 leading-relaxed">
                  Este día ya tiene <span className="font-bold">{registrados} ejercicio(s) registrados</span>.
                  Cambiar a {SESION_INFO[porConfirmar]?.label} dejaría ese registro apuntando a ejercicios que
                  no existen ahí, así que <span className="font-bold">se borrará</span>. Tus PRs no se tocan.
                </p>
              </div>
              <div className="flex gap-1.5 mt-2">
                <button onClick={() => setPorConfirmar(null)}
                  className="flex-1 py-1.5 rounded border border-[#2a3540] text-slate-300 text-[10px] font-bold uppercase">
                  Cancelar
                </button>
                <button onClick={() => { onFijar(dia.fecha, porConfirmar, secundaria, true); setPorConfirmar(null); setAbierto(false); }}
                  className="flex-1 py-1.5 rounded bg-red-600 text-white text-[10px] font-bold uppercase">
                  Cambiar y borrar
                </button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-1.5">
            {opciones.map(k => {
              const activa = k === actual;
              const esSugerida = k === sugerida;
              const elegir = () => {
                if (k === actual) { setAbierto(false); return; }
                if (registrados > 0) { setPorConfirmar(k); return; }
                onFijar(dia.fecha, k, secundaria);
                setAbierto(false);
              };
              return (
                <button key={k} onClick={elegir}
                  className={`py-2 px-2 rounded-lg border-2 text-left transition-all ${activa ? '' : 'border-[#2a3540]'}`}
                  style={activa ? { borderColor: SESION_INFO[k].color, background: SESION_INFO[k].color + '1f' } : undefined}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold" style={{ color: SESION_INFO[k].color }}>{SESION_INFO[k].label}</span>
                    {esSugerida && (
                      <span className="text-[8px] font-bold uppercase px-1 py-0.5 rounded bg-slate-700 text-slate-300">toca</span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 leading-tight">{SESION_INFO[k].tipo}</div>
                </button>
              );
            })}
          </div>
          {fijadaPorMi ? (
            <button onClick={() => { onSoltar(dia.fecha, secundaria); setAbierto(false); }}
              className="w-full py-2 rounded-lg border border-[#2a3540] text-slate-400 text-[10px] font-bold uppercase flex items-center justify-center gap-1.5">
              <RotateCcw size={12} /> Volver a la que toca por rotación
            </button>
          ) : (
            <p className="text-[9px] text-slate-600 leading-relaxed">
              Elegir otra no adelanta la cola: la que tocaba se hace en la siguiente sesión, no se pierde.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default SelectorVariante;
