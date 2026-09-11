import React from 'react';
import { Check, Trophy, Backpack, Zap, AlertTriangle, Link2, Sparkles, Ruler, Clock } from 'lucide-react';
import { PALAS_MAX_M } from '../../data.js';
import NumInput from '../comunes/NumInput.jsx';

// ═══════════════ EXERCISE CARD ═══════════════
const ExerciseCard = ({ ex, prog, pr, onToggleSet, onLog, onLastre, onBanda, color, avisoReset, ultima, sugerencia, onUsarSugerido }) => {
  const setCount = typeof ex.series === 'number' ? ex.series : 1;
  const p = prog || { sets: [], logs: [], lastre: null };
  const allDone = setCount > 0 && p.sets?.length === setCount && p.sets.every(Boolean);
  const isPR = pr?.flash;

  return (
    <div className={`rounded-lg border transition-all ${allDone ? 'border-emerald-600/50 bg-emerald-950/10' : 'border-[#232c34] bg-[#151b21]'}`}>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {ex.nuevo && (
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded flex items-center gap-1 border bg-green-500/20 border-green-400/60 text-green-300">
                  <Sparkles size={9} strokeWidth={3} />Nuevo v6
                </span>
              )}
              {ex.opcional && (
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded flex items-center gap-1 border bg-slate-600/20 border-slate-500/60 text-slate-300">
                  Opcional
                </span>
              )}
              {ex.bs && (
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded flex items-center gap-1 border"
                  style={{
                    background: ex.bstipo === 'ant' ? '#7c2d1233' : '#5b21b633',
                    borderColor: ex.bstipo === 'ant' ? '#c2410c88' : '#7c3aed88',
                    color: ex.bstipo === 'ant' ? '#fdba74' : '#c4b5fd'
                  }}>
                  <Link2 size={9} strokeWidth={3} />{ex.bs} · {ex.bstipo === 'ant' ? 'antag.' : 'no comp.'}
                </span>
              )}
              {allDone && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-300 border border-emerald-700/50 flex items-center gap-1"><Check size={9} strokeWidth={3} />Hecho</span>}
              {(ex.lastre || ex.acarreo) && pr?.kg != null && (
                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border flex items-center gap-1 ${isPR ? 'bg-amber-500/30 border-amber-400 text-amber-200 animate-pulse' : 'bg-amber-950/40 border-amber-700/50 text-amber-300'}`}>
                  <Trophy size={9} strokeWidth={3} />PR {pr.kg}kg
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-slate-100 leading-tight">{ex.nombre}</h3>
            {ex.nota && <p className="text-[11px] text-slate-500 mt-0.5">{ex.nota}</p>}
          </div>
        </div>

        {/* Historial y sugerencia · visibles sin tocar nada */}
        {(ultima || sugerencia) && (
          <div className="mb-2 px-2.5 py-2 rounded-lg bg-[#0f1417] border border-[#232c34] space-y-1">
            <div className="text-[11px] text-slate-300 leading-relaxed">
              {ultima ? (
                <>
                  <span className="text-slate-500">Última vez ({ultima.fecha.slice(8)}/{ultima.fecha.slice(5, 7)}):</span>{' '}
                  <span className="font-bold" style={{ fontFamily: 'ui-monospace, monospace' }}>
                    {ultima.kgMax ? `${ultima.kgMax} kg` : '—'}
                    {ultima.logs.length ? ` × ${ultima.logs.map(l => l.reps ?? '–').join(', ')}` : ''}
                  </span>
                </>
              ) : (
                <span className="text-slate-500">Primera vez con este ejercicio.</span>
              )}
            </div>
            {sugerencia && sugerencia.tipo !== 'primera' && sugerencia.tipo !== 'no-aplica' && (
              <div className="text-[11px] leading-relaxed"
                style={{ color: sugerencia.tipo === 'reset' ? '#fb923c' : sugerencia.tipo === 'subir' ? '#4ade80' : '#94a3b8' }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold">
                    Sugerido: {sugerencia.kg != null ? `${sugerencia.kg} kg` : '—'}
                  </span>
                  {/* Un toque en vez de teclear la misma cifra en cada serie.
                      Solo rellena las que aún no tienen carga: nunca pisa lo anotado. */}
                  {sugerencia.kg != null && onUsarSugerido && (
                    <button onClick={() => onUsarSugerido(ex.id, sugerencia.kg, setCount)}
                      aria-label={`Usar ${sugerencia.kg} kg en ${ex.nombre}`}
                      className="text-[9px] font-bold uppercase px-2 py-0.5 rounded border border-current opacity-90">
                      Usar
                    </button>
                  )}
                </div>
                <span className="text-slate-500">{sugerencia.motivo}</span>
              </div>
            )}
            {sugerencia && (sugerencia.tipo === 'primera' || sugerencia.tipo === 'no-aplica') && (
              <div className="text-[11px] text-slate-500 leading-relaxed">{sugerencia.motivo}</div>
            )}
          </div>
        )}

        {/* Palas · límite por carga de hombro */}
        {ex.palas && (
          <div className="mb-2 px-2.5 py-2 rounded-lg border-l-4 border-amber-600 bg-amber-950/20">
            <p className="text-[11px] text-amber-100 leading-relaxed">
              <span className="font-bold">Máximo {PALAS_MAX_M} m de palas por sesión.</span> Con tus series de press y
              tirón el hombro ya va cargado y las palas multiplican la fuerza sobre el manguito. Si aparece molestia,
              lo primero que sale son las palas — nunca el face pull, que es lo que protege.
            </p>
          </div>
        )}

        {/* Aviso de reset · regla P6 */}
        {avisoReset && (
          <div className="mb-2 px-2.5 py-2 rounded-lg border-l-4 border-orange-500 bg-orange-950/25">
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="text-orange-400 flex-shrink-0 mt-0.5" />
              <div className="text-[11px] text-orange-100 leading-relaxed">
                <span className="font-bold">Toca reset (P6).</span> Fallaste el objetivo de {avisoReset.objetivo} reps
                dos sesiones seguidas ({avisoReset.conseguido.join(' y ')} reps).
                {avisoReset.sugerido != null && (
                  <> Baja de <span className="font-bold">{avisoReset.actual} kg</span> a <span className="font-bold">{avisoReset.sugerido} kg</span> y vuelve a subir desde ahí.</>
                )}
              </div>
            </div>
          </div>
        )}

        {/* v6: los compuestos de Parte 1 muestran la progresión LINEAL en lugar del RIR */}
        <div className="grid grid-cols-4 gap-1.5 mb-2">
          {[
            ['Series', ex.series, false],
            ['Reps', ex.reps, false],
            ex.lineal ? ['Lineal', ex.progresion, true] : ['RIR', ex.rir ?? '—', false],
            ['Desc.', ex.descanso, false],
          ].map(([l, v, destaca], i) => (
            <div key={i} className={`px-1.5 py-1 rounded text-center border ${destaca ? 'bg-amber-950/30 border-amber-700/50' : 'bg-[#0f1417] border-[#232c34]'}`}>
              <div className={`text-[8px] uppercase tracking-wide font-semibold ${destaca ? 'text-amber-500/80' : 'text-slate-600'}`}>{l}</div>
              <div className={`text-xs font-bold ${destaca ? 'text-amber-200' : 'text-slate-200'}`} style={{ fontFamily: 'ui-monospace, monospace' }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Banda de asistencia */}
        {ex.banda && (
          <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded bg-purple-950/20 border border-purple-900/40">
            <Zap size={14} className="text-purple-400 flex-shrink-0" />
            <span className="text-[10px] uppercase tracking-wide text-purple-300/80 font-semibold">Banda</span>
            <input
              type="text"
              value={p.banda ?? ''}
              onChange={(e) => onBanda(ex.id, e.target.value)}
              placeholder="color/nivel"
              className="flex-1 min-w-0 h-8 px-2 bg-[#0f1417] border border-[#3a2a50] focus:border-purple-500/60 focus:outline-none text-slate-100 text-xs rounded"
            />
          </div>
        )}

        {/* Acarreo (distancia + carga) */}
        {ex.acarreo && (
          <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded bg-cyan-950/20 border border-cyan-900/40 flex-wrap">
            <Ruler size={14} className="text-cyan-400 flex-shrink-0" />
            <span className="text-[10px] uppercase tracking-wide text-cyan-300/80 font-semibold">Acarreo</span>
            <input type="text" inputMode="numeric" value={p.banda ?? ''}
              onChange={(e) => onBanda(ex.id, e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="m" className="w-12 h-8 px-1 bg-[#0f1417] border border-cyan-900/50 focus:border-cyan-500/60 focus:outline-none text-slate-100 text-xs text-center rounded" />
            <span className="text-[10px] text-slate-500">m</span>
            <NumInput value={p.lastre} onChange={(v) => onLastre(ex.id, v === '' ? null : parseFloat(v))} placeholder="kg" w="w-12" />
            <span className="text-[10px] text-slate-500">kg</span>
            <span className="text-[9px] text-cyan-500/70 w-full">Sube primero distancia (30→40→50m), luego carga</span>
          </div>
        )}

        {/* Isométrico (segundos) - métrica clave */}
        {ex.iso && (
          <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded bg-rose-950/20 border border-rose-900/40 flex-wrap">
            <Clock size={14} className="text-rose-400 flex-shrink-0" />
            <span className="text-[10px] uppercase tracking-wide text-rose-300/80 font-semibold">Isométrico</span>
            <NumInput value={p.segundos} onChange={(v) => onLastre(ex.id, v === '' ? null : parseFloat(v))} placeholder="seg" w="w-14" />
            <span className="text-[10px] text-slate-500">seg</span>
            <span className="text-[9px] text-rose-500/70 w-full">Métrica clave del objetivo. Solo tiempo hasta 60s, luego carga</span>
          </div>
        )}

        {/* Lastre (mochila) */}
        {ex.lastre && (
          <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded bg-amber-950/20 border border-amber-900/40">
            <Backpack size={14} className="text-amber-400 flex-shrink-0" />
            <span className="text-[10px] uppercase tracking-wide text-amber-300/80 font-semibold">Lastre</span>
            <NumInput value={p.lastre} onChange={(v) => onLastre(ex.id, v === '' ? null : parseFloat(v))} placeholder="kg" w="w-14" />
            <span className="text-[10px] text-slate-500">kg</span>
          </div>
        )}

        {/* Checklist de series */}
        {setCount > 0 && (
          <div className="flex items-start gap-1.5 flex-wrap pt-2 border-t border-[#232c34]">
            {Array.from({ length: setCount }).map((_, i) => {
              const checked = p.sets?.[i];
              const log = p.logs?.[i] || {};
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <button onClick={() => onToggleSet(ex.id, i, setCount, ex)}
                    className={`w-9 h-9 rounded-md border-2 flex items-center justify-center font-bold text-xs transition-all ${checked ? 'border-transparent' : 'border-[#2a3540] bg-[#0f1417] text-slate-500'}`}
                    style={{ background: checked ? color : undefined, color: checked ? '#0a0a0a' : undefined, fontFamily: 'ui-monospace, monospace' }}>
                    {checked ? <Check size={14} strokeWidth={3} /> : i + 1}
                  </button>
                  {checked && (ex.lineal || (ex.rir && ex.rir !== '—')) && (
                    <div className="flex flex-col gap-0.5">
                      <NumInput value={log.kg} onChange={(v) => onLog(ex.id, i, { ...log, kg: v === '' ? null : parseFloat(v) }, setCount)} placeholder="kg" />
                      <NumInput value={log.reps} onChange={(v) => onLog(ex.id, i, { ...log, reps: v === '' ? null : parseInt(v, 10) }, setCount)} placeholder="rep" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExerciseCard;
