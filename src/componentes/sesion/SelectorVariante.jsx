import React, { useState } from 'react';
import { ChevronRight, AlertTriangle, RotateCcw } from 'lucide-react';
import { SESION_INFO, SECUENCIA_NATACION, SECUENCIA_GYM } from '../../data.js';
import { useAccionesCtx, usePlanCtx } from '../../estado/contextos.js';
import { avisoAlFijar } from '../../generador.js';

// ═══════════════ SELECTOR DE VARIANTE DENTRO DEL DÍA ═══════════════
// El tipo (gym / natación) se elige en configuración; CUÁL de la cola toca se ve
// y se cambia aquí. Fijar una a mano no adelanta la cola: la que tocaba se hace
// en la siguiente sesión (ver POLITICA_FIJADO en generador.js).
const SelectorVariante = ({ dia, secundaria = false, registrados = 0 }) => {
  const { fijarVariante: onFijar, soltarVariante: onSoltar } = useAccionesCtx();
  const { calendario } = usePlanCtx();
  const [abierto, setAbierto] = useState(false);
  const [porConfirmar, setPorConfirmar] = useState(null);   // clave elegida pendiente de confirmar
  const [porAvisar, setPorAvisar] = useState(null);         // { clave, avisos } · solape o S7 al fijar
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
  // Los avisos solo aplican al gym: la natación no tiene patrones que solapen
  // ni entra en S7. La secundaria tampoco se mira aquí — un gym doblado ya pasa
  // por el guardarraíl del generador, que sí ve esa colocación.
  const avisosDe = (k) => (esGym && !secundaria) ? avisoAlFijar(calendario, dia.fecha, k) : [];
  const fijar = (k) => { onFijar(dia.fecha, k, secundaria); setAbierto(false); };

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
              {/* Si además solapa o rompe S7, se dice aquí mismo: un solo paso de
                  confirmación, pero con los dos problemas delante. */}
              {avisosDe(porConfirmar).map((a, i) => (
                <p key={i} className="text-[11px] text-amber-200/90 leading-relaxed mt-1.5 pl-6">
                  <span className="font-bold">{a.regla === 'S7' ? 'S7 · ' : 'Solape · '}</span>{a.texto}
                </p>
              ))}
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
          {/* Fijar a mano se salta las reglas del generador, que solo protege
              hacia delante. Si la elegida solapa con el gym anterior o rompe la
              separación de S7, se avisa ANTES y se exige confirmar. No se
              reescribe ningún día: la decisión sigue siendo del usuario. */}
          {porAvisar && (
            <div className="px-2.5 py-2 rounded-lg border-l-4 border-amber-500 bg-amber-950/25">
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-amber-200">
                    Fijar {SESION_INFO[porAvisar.clave]?.label} aquí tiene {porAvisar.avisos.length === 1 ? 'un problema' : `${porAvisar.avisos.length} problemas`}:
                  </p>
                  {porAvisar.avisos.map((a, i) => (
                    <p key={i} className="text-[11px] text-amber-100/90 leading-relaxed">
                      <span className="font-bold">{a.regla === 'S7' ? 'S7 · ' : 'Solape · '}</span>{a.texto}
                    </p>
                  ))}
                </div>
              </div>
              <div className="flex gap-1.5 mt-2">
                <button onClick={() => setPorAvisar(null)} aria-label="Cancelar el cambio de sesión"
                  className="flex-1 py-1.5 rounded border border-[#2a3540] text-slate-300 text-[10px] font-bold uppercase">
                  Mejor no
                </button>
                <button onClick={() => { fijar(porAvisar.clave); setPorAvisar(null); }} aria-label="Fijar igual"
                  className="flex-1 py-1.5 rounded bg-amber-600 text-slate-900 text-[10px] font-bold uppercase">
                  Fijar igual
                </button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-1.5">
            {opciones.map(k => {
              const activa = k === actual;
              const esSugerida = k === sugerida;
              const avisos = activa ? [] : avisosDe(k);
              const elegir = () => {
                if (k === actual) { setAbierto(false); return; }
                if (registrados > 0) { setPorConfirmar(k); return; }
                if (avisos.length) { setPorAvisar({ clave: k, avisos }); return; }
                fijar(k);
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
                    {avisos.length > 0 && (
                      <span aria-label={`${SESION_INFO[k].label} con aviso`}
                        className="text-[8px] font-bold uppercase px-1 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-700/60">
                        {avisos.some(a => a.regla === 'S7') ? 'S7' : 'solapa'}
                      </span>
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
