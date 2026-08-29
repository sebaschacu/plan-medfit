import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Dumbbell, Home, Waves, Moon, Check,
  Timer, Trophy, RotateCcw, ChevronLeft, ChevronRight, X, Backpack,
  Settings, ArrowLeft, Zap, Activity, Circle, Star, AlertTriangle, Flame, TrendingUp, Link2, Sparkles, Ruler, Clock
} from 'lucide-react';
import {
  TURNO_INFO, SESION_INFO, SESIONES, DIAS_SEMANA,
  MUSCULOS, CAT_MUSCULO, RANGO_VOLUMEN, PARTES, COMPLEMENTOS, DOBLES,
  PALAS_MAX_M, PISCINA_DURACION_MIN, CARDIO_FLEXIBLE,
} from './data.js';
import {
  generarMes, infoMes, ANCLA_DEFAULT, FESTIVOS_DEFAULT,
  combinacionValida, ordenDoble, validarSeparacion,
} from './generador.js';
import { calcularAvisosReset, S4, calcularCSS, tablaRitmos, mmss } from './reglas.js';
import { verificarSesion } from './validador.js';
import {
  resolverRutina, estaEditada, guardarVersion, restaurarPlan, huerfanosDelDia,
  catalogoEjercicios, nuevoId, mover, gruposBS,
} from './rutina.js';

// ═══════════════ HELPERS ═══════════════

// ─── Estado "día completado" (v6 · 7.1) ───
// INTENCIÓN DE DISEÑO: un día hecho DESTACA, no se atenúa. Esto es un rastreador
// de hábitos y el acumulado visible es parte de lo que empuja a seguir; apagar lo
// ya entrenado convertía el mes cumplido en la parte más gris de la pantalla.
//
// El tratamiento es un marco encendido del color de la PROPIA sesión: fondo de ese
// color al 14%, borde de 1.5px en los cuatro lados, y el borde superior pasa del
// color del turno al de la sesión. El ícono y la etiqueta se quedan en su tono vivo.
// Al derivarse del color de cada sesión desaparece el problema que tenía el lila
// fijo: ya no hay un color ajeno que compita con el morado de la calistenia.
// El turno no se pierde — la letra junto al número del día sigue con su color.
const COMPLETADO = {
  alphaFondo: 0.14,
  borde: '1.5px',
  bordeSuperior: '3px',
  // El padding NO se compensa, y es deliberado: Chromium redondea los bordes
  // sub-píxel hacia abajo, así que ese 1.5px se usa como 1px en el cálculo de
  // layout — igual que el borde por defecto. Medido en densidades 1, 2 y 3.
  // Restarle medio píxel al padding "para compensar" encogía la celda 0.5px y
  // hacía bailar la cuadrícula al marcar un día.
  padding: '4px',
};

// #22c55e → rgba(34, 197, 94, alpha). Los colores viven en SESION_INFO; derivarlos
// aquí evita duplicar la paleta en cada celda.
const hexARgba = (hex, alpha) => {
  const h = String(hex || '').replace('#', '');
  const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const v = parseInt(n, 16);
  if (n.length !== 6 || Number.isNaN(v)) return `rgba(148, 163, 184, ${alpha})`;
  return `rgba(${(v >> 16) & 255}, ${(v >> 8) & 255}, ${v & 255}, ${alpha})`;
};

const parseRest = (s) => {
  if (!s || s === '—' || s.includes('0s')) return null;
  const n = parseFloat(s.replace(',', '.'));
  if (isNaN(n)) return null;
  const range = s.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
  const v = range ? parseFloat(range[2]) : n;
  return s.toLowerCase().includes('min') ? Math.round(v * 60) : Math.round(v);
};

const playBeep = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880; o.type = 'sine';
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    o.start(); o.stop(ctx.currentTime + 0.4);
  } catch { /* sin AudioContext: el pitido es opcional */ }
};
const vibrate = (p) => { try { navigator.vibrate?.(p); } catch { /* sin motor de vibración */ } };
const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

// Fecha local de hoy en ISO (no UTC: si no, de noche en Colombia saltaría al día siguiente).
const hoyISO = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};

// ═══════════════ CARGA DEL ESTADO GUARDADO ═══════════════
// Se lee UNA vez y de forma síncrona, para usarla en inicializadores lazy de
// useState. Antes esto vivía en un useEffect con seis setState: la app pintaba
// el estado por defecto, luego saltaba al guardado, y en StrictMode el effect
// corría dos veces. Leyéndolo aquí, el primer render ya es el bueno.
let _guardado;
function estadoGuardado() {
  if (_guardado) return _guardado;
  _guardado = { ancla: null, fijados: {}, extras: {}, css: null, rutina: {}, festivos: null, prog: {}, prs: {} };
  try {
    const raw = localStorage.getItem('plan-internado');
    if (!raw) return _guardado;
    const d = JSON.parse(raw);
    if (d.v === 3) {
      _guardado = {
        ancla: d.ancla ?? null,
        fijados: d.fijados ?? {},
        extras: d.extras ?? {},
        css: d.css ?? null,
        rutina: d.rutina ?? {},
        festivos: Array.isArray(d.festivos) ? d.festivos : null,
        prog: d.prog ?? {},
        prs: d.prs ?? {},
      };
      return _guardado;
    }
    // ── MIGRACIÓN v2 → v3 ──
    // En la v2 el progreso se indexaba por NÚMERO DE DÍA (1..31) y el calendario
    // era siempre agosto 2026. Con multi-mes ese número es ambiguo, así que las
    // claves se reindexan a fecha ISO asumiendo agosto 2026, que es lo que eran.
    const prog = {};
    for (const [k, v] of Object.entries(d.prog ?? {})) {
      const n = Number(k);
      prog[Number.isInteger(n) && n >= 1 && n <= 31
        ? `2026-08-${String(n).padStart(2, '0')}`
        : k] = v;
    }
    // El calendario v2 escrito a mano se DESCARTA: lo sustituye el generador.
    // Los festivos que hubiera marcado sí se conservan, y van al ARRAY `festivos`,
    // que es de donde los lee el generador.
    const fest = Array.isArray(d.cal)
      ? d.cal.filter(x => x.festivo && x.dia).map(x => `2026-08-${String(x.dia).padStart(2, '0')}`)
      : [];
    _guardado = {
      ancla: null,
      fijados: {},
      festivos: fest.length ? [...new Set([...FESTIVOS_DEFAULT, ...fest])] : null,
      prog,
      prs: d.prs ?? {},
    };
  } catch { /* localStorage bloqueado o JSON corrupto: se arranca de cero */ }
  return _guardado;
}

// Objeto vacío compartido: `algo || {}` crea uno nuevo en cada render y hace
// que los useMemo que dependen de él se recalculen siempre.
const VACIO = {};

const GYM_PIERNA_UI = ['gymC1', 'gymC2'];

const NOMBRES_MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const mesDeISO = (f) => NOMBRES_MES[Number(f.slice(5, 7)) - 1];

const IconFor = ({ name, size = 20, color, style }) => {
  const p = { size, color, style, strokeWidth: 2 };
  switch (name) {
    case 'dumbbell': return <Dumbbell {...p} />;
    case 'home': return <Home {...p} />;
    case 'waves': return <Waves {...p} />;
    case 'run': return <Activity {...p} />;
    case 'moon': return <Moon {...p} />;
    case 'dot': return <Circle {...p} />;
    default: return <Zap {...p} />;
  }
};

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

// ═══════════════ EXERCISE CARD ═══════════════
const ExerciseCard = ({ ex, prog, pr, onToggleSet, onLog, onLastre, onBanda, color, avisoReset }) => {
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





// ═══════════════ EDITOR DE RUTINA ═══════════════
// Libertad total sobre la sesión, con el verificador informando en vivo.
// NO bloquea: clasifica en duras y blandas y exige un motivo al guardar, que es
// lo que hace útil la revisión de las 8 semanas (N3).
const EditorRutina = ({ sesionKey, ejercicios: iniciales, onGuardar, onRestaurar, onCerrar, editada }) => {
  const [lista, setLista] = useState(() => JSON.parse(JSON.stringify(iniciales)));
  const [motivo, setMotivo] = useState('');
  const [anadiendo, setAnadiendo] = useState(false);
  const [busca, setBusca] = useState('');

  const info = SESION_INFO[sesionKey];
  const res = useMemo(() => verificarSesion(sesionKey, lista), [sesionKey, lista]);
  const catalogo = useMemo(() => catalogoEjercicios(), []);
  const yaEstan = new Set(lista.map(e => e.id));
  const candidatos = catalogo
    .filter(e => !yaEstan.has(e.id))
    .filter(e => !busca || e.nombre.toLowerCase().includes(busca.toLowerCase()))
    .slice(0, 40);

  const editar = (i, cambio) => setLista(l => l.map((e, j) => j === i ? { ...e, ...cambio } : e));
  const quitar = (i) => setLista(l => l.filter((_, j) => j !== i));
  const anadir = (ex) => {
    const copia = { ...JSON.parse(JSON.stringify(ex)), parte: 3, bs: undefined };
    delete copia.origen; delete copia.origenNombre;
    if (yaEstan.has(copia.id)) copia.id = nuevoId(sesionKey, lista);
    setLista(l => [...l, copia]);
    setAnadiendo(false); setBusca('');
  };

  const series = lista.filter(e => !e.opcional).reduce((a, e) => a + (typeof e.series === 'number' ? e.series : 0), 0);
  const grupos = gruposBS(lista);

  return (
    <div className="min-h-screen bg-[#0f1417]">
      <header className="sticky top-0 z-30 bg-[#0f1417]/95 backdrop-blur border-b border-[#232c34]">
        <div className="px-4 py-3">
          <button onClick={onCerrar} className="flex items-center gap-1.5 text-slate-400 text-xs font-bold uppercase tracking-wide mb-2">
            <ArrowLeft size={14} /> Salir sin guardar
          </button>
          <h1 className="text-lg font-bold text-slate-50 leading-tight">Editar {info?.label}</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {lista.length} ejercicios · {series} series obligatorias
            {editada && <span className="text-amber-400"> · ya editada respecto al plan</span>}
          </p>
        </div>

        {/* Verificador en vivo */}
        <div className="px-4 pb-3">
          {res.duras.length === 0 && res.blandas.length === 0 ? (
            <div className="px-3 py-2 rounded-lg bg-emerald-950/30 border border-emerald-800/40 flex items-center gap-2">
              <Check size={14} className="text-emerald-400" strokeWidth={3} />
              <span className="text-[11px] text-emerald-300 font-bold">Cumple todas las reglas del plan</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {res.duras.map((d, i) => (
                <div key={'d' + i} className="px-3 py-2 rounded-lg border-l-4 border-red-500 bg-red-950/25 flex items-start gap-2">
                  <AlertTriangle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-red-100 leading-relaxed">
                    <span className="font-bold">{d.regla}.</span> {d.texto}
                  </p>
                </div>
              ))}
              {res.blandas.map((b, i) => (
                <div key={'b' + i} className="px-3 py-2 rounded-lg border-l-4 border-amber-600 bg-amber-950/20 flex items-start gap-2">
                  <AlertTriangle size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-100/90 leading-relaxed">
                    <span className="font-bold">{b.regla}.</span> {b.texto}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="px-3 py-3 max-w-2xl mx-auto pb-32 space-y-2">
        {lista.map((ex, i) => {
          const senalado = [...res.duras, ...res.blandas].some(h => h.ejercicios?.includes(ex.id));
          return (
            <div key={ex.id + i} className={`rounded-lg border bg-[#151b21] p-2.5 ${senalado ? 'border-red-800/60' : 'border-[#232c34]'}`}>
              <div className="flex items-start gap-2">
                <div className="flex flex-col gap-0.5 flex-shrink-0">
                  <button onClick={() => setLista(l => mover(l, i, -1))} disabled={i === 0}
                    aria-label="Subir" className="w-7 h-6 rounded border border-[#2a3540] text-slate-400 disabled:text-slate-700 flex items-center justify-center">
                    <ChevronLeft size={13} className="rotate-90" />
                  </button>
                  <button onClick={() => setLista(l => mover(l, i, 1))} disabled={i === lista.length - 1}
                    aria-label="Bajar" className="w-7 h-6 rounded border border-[#2a3540] text-slate-400 disabled:text-slate-700 flex items-center justify-center">
                    <ChevronRight size={13} className="rotate-90" />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-100 leading-tight">{ex.nombre}</div>
                  <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                    <select value={ex.parte ?? 3} onChange={e => editar(i, { parte: e.target.value === 'finisher' ? 'finisher' : Number(e.target.value) })}
                      aria-label="Parte" className="h-7 px-1 bg-[#0f1417] border border-[#2a3540] text-slate-300 text-[10px] rounded">
                      <option value={1}>Parte 1</option>
                      <option value={2}>Parte 2</option>
                      <option value={3}>Parte 3</option>
                      <option value="finisher">Finisher</option>
                    </select>
                    <select value={ex.bs ?? ''} onChange={e => editar(i, { bs: e.target.value || undefined })}
                      aria-label="Bi-serie" className="h-7 px-1 bg-[#0f1417] border border-[#2a3540] text-slate-300 text-[10px] rounded">
                      {grupos.map(g => <option key={g ?? 'none'} value={g ?? ''}>{g ?? 'Sin bi-serie'}</option>)}
                    </select>
                    <NumInput value={ex.series} onChange={v => editar(i, { series: v === '' ? 0 : parseInt(v, 10) })} placeholder="ser" w="w-11" etiqueta={`Series de ${ex.nombre}`} />
                    <button onClick={() => editar(i, { opcional: !ex.opcional })}
                      className={`h-7 px-2 rounded border text-[10px] font-bold ${ex.opcional ? 'border-slate-500 bg-slate-700/30 text-slate-300' : 'border-[#2a3540] text-slate-500'}`}>
                      {ex.opcional ? 'Opcional *' : 'Obligatorio'}
                    </button>
                    <button onClick={() => quitar(i)} aria-label={`Quitar ${ex.nombre}`}
                      className="h-7 w-7 rounded border border-red-900/50 text-red-400 flex items-center justify-center ml-auto">
                      <X size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Añadir ejercicio */}
        {anadiendo ? (
          <div className="rounded-lg border border-[#232c34] bg-[#151b21] p-2.5">
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar ejercicio…" aria-label="Buscar ejercicio"
              className="w-full h-9 px-2 mb-2 bg-[#0f1417] border border-[#2a3540] focus:border-emerald-600 focus:outline-none text-slate-100 text-xs rounded" />
            <div className="max-h-64 overflow-y-auto space-y-1">
              {candidatos.map(e => (
                <button key={e.origen + e.id} onClick={() => anadir(e)}
                  className="w-full text-left px-2 py-1.5 rounded border border-[#232c34] hover:border-emerald-700">
                  <div className="text-[12px] text-slate-200">{e.nombre}</div>
                  <div className="text-[9px] text-slate-600">{SESION_INFO[e.origen]?.label ?? e.origen}</div>
                </button>
              ))}
              {!candidatos.length && <p className="text-[11px] text-slate-600 py-2 text-center">Nada que coincida.</p>}
            </div>
            <button onClick={() => { setAnadiendo(false); setBusca(''); }}
              className="w-full mt-2 py-1.5 text-[10px] uppercase font-bold text-slate-400">Cancelar</button>
          </div>
        ) : (
          <button onClick={() => setAnadiendo(true)}
            className="w-full py-2.5 rounded-lg border border-dashed border-[#2a3540] text-slate-400 text-[11px] font-bold uppercase">
            + Añadir ejercicio
          </button>
        )}

        <button onClick={onRestaurar}
          className="w-full py-2 rounded-lg border border-amber-800/50 bg-amber-950/20 text-amber-300 text-[10px] font-bold uppercase flex items-center justify-center gap-1.5">
          <RotateCcw size={12} /> Volver al plan original
        </button>
      </main>

      {/* Guardar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0f1417]/95 backdrop-blur border-t border-[#232c34] p-3">
        <div className="max-w-2xl mx-auto space-y-2">
          <input value={motivo} onChange={e => setMotivo(e.target.value)} aria-label="Motivo del cambio"
            placeholder="¿Por qué lo cambias? (se guarda con la versión)"
            className="w-full h-9 px-2 bg-[#151b21] border border-[#2a3540] focus:border-emerald-600 focus:outline-none text-slate-100 text-xs rounded" />
          <div className="flex gap-2">
            <button onClick={onCerrar} className="px-4 py-2.5 border border-[#2a3540] text-slate-300 text-xs font-bold uppercase rounded-lg">Cancelar</button>
            <button onClick={() => onGuardar(lista, motivo)} disabled={!motivo.trim()}
              className={`flex-1 py-2.5 text-white text-xs font-bold uppercase rounded-lg ${
                !motivo.trim() ? 'bg-slate-700 text-slate-500' : res.duras.length ? 'bg-amber-700' : 'bg-emerald-600'}`}>
              {!motivo.trim() ? 'Escribe el motivo' : res.duras.length ? `Guardar con ${res.duras.length} aviso(s)` : 'Guardar'}
            </button>
          </div>
          <p className="text-[9px] text-slate-600 leading-relaxed">
            Se guarda como versión de hoy. Las sesiones que ya entrenaste conservan los ejercicios que hiciste.
          </p>
        </div>
      </div>
    </div>
  );
};

// Declarado a nivel de módulo a propósito: definirlo dentro del render crea un
// COMPONENTE NUEVO en cada pasada, así que React desmonta y remonta el árbol y
// se pierde el estado y el foco. Es el aviso static-components del linter.
const BotonSiNo = ({ activo, onClick, children }) => (
  <button onClick={onClick}
    className={`flex-1 py-1.5 rounded-md border text-[11px] font-bold transition-all ${
      activo ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300' : 'border-[#2a3540] text-slate-400'}`}>
    {children}
  </button>
);

// ═══════════════ DÍA FLEXIBLE · las tres condiciones ═══════════════
// Por defecto descanso. Pasa a running solo si se cumplen las TRES. La tercera
// la calcula el generador (no venir de dos días de gym seguidos); las otras dos
// dependen de datos que solo sabe el usuario, así que se preguntan.
const PanelFlexible = ({ dia, respuesta, onResponder, onConvertir }) => {
  const cond3 = dia.flexibleCond3 !== false;
  const durmio = respuesta?.sueno;
  const peso = respuesta?.peso;
  const todas = cond3 && durmio === true && peso === true;
  const contestadas = durmio != null && peso != null;

  return (
    <div className="mb-3 rounded-lg border-l-4 border-slate-500 bg-slate-800/20 px-3 py-2.5">
      <div className="flex items-start gap-2 mb-2">
        <Zap size={15} className="text-slate-400 flex-shrink-0 mt-0.5" />
        <div className="text-[11px] text-slate-300 leading-relaxed">
          <span className="font-bold">Día flexible.</span> Es el día negociable de la semana y cae en turno C, que ya son
          12h de pie. Por defecto descansas; pasa a running solo si se cumplen las tres condiciones.
          {dia.sugerencia?.sesion === 'running' && (
            <span className="block mt-1 text-amber-300">{dia.sugerencia.motivo}</span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500 font-bold mb-1">¿Dormiste bien esta semana?</div>
          <div className="flex gap-1.5">
            <BotonSiNo activo={durmio === true} onClick={() => onResponder(dia.fecha, { sueno: true })}>Sí</BotonSiNo>
            <BotonSiNo activo={durmio === false} onClick={() => onResponder(dia.fecha, { sueno: false })}>No</BotonSiNo>
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500 font-bold mb-1">¿El peso corporal va subiendo?</div>
          <div className="flex gap-1.5">
            <BotonSiNo activo={peso === true} onClick={() => onResponder(dia.fecha, { peso: true })}>Sí</BotonSiNo>
            <BotonSiNo activo={peso === false} onClick={() => onResponder(dia.fecha, { peso: false })}>No</BotonSiNo>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <span className={cond3 ? 'text-emerald-400' : 'text-red-400'}>{cond3 ? '✓' : '✗'}</span>
          <span className="text-[11px] text-slate-400">
            No vienes de dos días de gym seguidos {cond3 ? '— cumplida' : '— NO cumplida, esta la calcula la app'}
          </span>
        </div>
      </div>

      {contestadas && (
        todas ? (
          <div className="mt-2.5 space-y-1.5">
            <p className="text-[11px] text-emerald-300 font-bold">Las tres se cumplen. ¿Qué haces hoy?</p>
            <div className="flex gap-1.5">
              {CARDIO_FLEXIBLE.map(k => (
                <button key={k} onClick={() => onConvertir(dia.fecha, k)}
                  className="flex-1 py-2 rounded-lg text-white text-[11px] font-bold uppercase"
                  style={{ background: SESION_INFO[k].color }}>
                  {SESION_INFO[k].label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Vienes de 12h de pie: la bici da el mismo Z2 sin castigar pies, tibias ni sóleo, y de paso
              cubre el ciclismo que te falta para triatlón. Correr solo si los pies vienen bien.
            </p>
          </div>
        ) : (
          <p className="text-[11px] text-slate-400 mt-2.5 leading-relaxed">
            No se cumplen las tres: hoy <span className="font-bold text-slate-300">descansas</span>.
            {!cond3 && ' Vienes de dos días de gym seguidos.'}
            {durmio === false && ' No dormiste bien.'}
            {peso === false && ' El peso no sube: come más antes de añadir cardio.'}
          </p>
        )
      )}
    </div>
  );
};

// ═══════════════ CSS · TEST Y TABLA DE RITMOS ═══════════════
// Sin este número todos los ritmos del plan son adivinanzas. La tabla se enseña
// en toda sesión de agua porque en el borde de la piscina no se va calculando.
const PanelCSS = ({ css, onCSS, esTest }) => {
  const [t400, setT400] = useState('');
  const [t200, setT200] = useState('');
  const calc = (t400 && t200) ? calcularCSS(t400, t200) : null;
  const activo = css ?? calc?.segPor100 ?? null;
  const tabla = tablaRitmos(activo);

  return (
    <div className="mb-3 rounded-lg border border-cyan-900/40 bg-cyan-950/10 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-cyan-900/30">
        <div className="text-[10px] uppercase tracking-wide text-cyan-400 font-bold">
          {esTest ? 'Test de CSS' : 'Tus ritmos'}
        </div>
        {activo != null && (
          <div className="text-lg font-bold text-cyan-200 mt-0.5" style={{ fontFamily: 'ui-monospace, monospace' }}>
            CSS {mmss(activo)} <span className="text-xs font-normal text-slate-400">/ 100 m</span>
          </div>
        )}
      </div>

      {esTest && (
        <div className="px-3 py-2.5 space-y-2 border-b border-cyan-900/30">
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Apunta los dos tiempos y la app calcula tu CSS. Formato <span className="font-bold">6:40</span> o segundos.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wide text-slate-500 font-bold w-16">400 m</span>
            <input value={t400} onChange={e => setT400(e.target.value)} placeholder="6:40" aria-label="Tiempo de los 400 metros"
              className="w-20 h-8 px-2 bg-[#0f1417] border border-[#2a3540] focus:border-cyan-600 focus:outline-none text-slate-100 text-xs text-center rounded"
              style={{ fontFamily: 'ui-monospace, monospace' }} />
            <span className="text-[10px] uppercase tracking-wide text-slate-500 font-bold w-16">200 m</span>
            <input value={t200} onChange={e => setT200(e.target.value)} placeholder="3:10" aria-label="Tiempo de los 200 metros"
              className="w-20 h-8 px-2 bg-[#0f1417] border border-[#2a3540] focus:border-cyan-600 focus:outline-none text-slate-100 text-xs text-center rounded"
              style={{ fontFamily: 'ui-monospace, monospace' }} />
          </div>
          {calc?.error && <p className="text-[11px] text-red-400">{calc.error}</p>}
          {calc?.aviso && <p className="text-[11px] text-amber-300">{calc.aviso}</p>}
          {calc?.segPor100 && !calc.error && (
            <button onClick={() => onCSS(calc.segPor100)}
              className="w-full py-2 rounded-lg bg-cyan-700 text-white text-[11px] font-bold uppercase">
              Guardar CSS {mmss(calc.segPor100)}
            </button>
          )}
        </div>
      )}

      {tabla.length > 0 ? (
        <div className="px-3 py-2.5">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]" style={{ fontFamily: 'ui-monospace, monospace' }}>
              <thead>
                <tr className="text-slate-500 text-[9px] uppercase tracking-wide">
                  <th className="text-left font-bold pb-1">Ritmo</th>
                  <th className="text-right font-bold pb-1">50</th>
                  <th className="text-right font-bold pb-1">100</th>
                  <th className="text-right font-bold pb-1">200</th>
                  <th className="text-right font-bold pb-1">400</th>
                </tr>
              </thead>
              <tbody>
                {tabla.map(r => (
                  <tr key={r.clave} className={r.clave === 'CSS' ? 'text-cyan-300 font-bold' : 'text-slate-300'}>
                    <td className="py-0.5">{r.clave}</td>
                    <td className="text-right">{r.por50}</td>
                    <td className="text-right">{r.por100}</td>
                    <td className="text-right">{r.por200}</td>
                    <td className="text-right">{r.por400}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[9px] text-slate-600 mt-2 leading-relaxed">
            {tabla.find(r => r.clave === 'CSS+5')?.uso && 'CSS+5 para aeróbico sostenido · CSS−5 para series cortas. '}
            Repite el test cada 6-8 semanas: es tu métrica principal.
          </p>
        </div>
      ) : (
        <p className="px-3 py-2.5 text-[11px] text-slate-500 leading-relaxed">
          Aún no tienes CSS. Hazte el test en tu primera sesión: sin ese número, los ritmos del plan son adivinanzas.
        </p>
      )}
    </div>
  );
};

// ═══════════════ SEGUNDA SESIÓN Y COMPLEMENTOS ═══════════════
// El déficit de días se cubre doblando, no recortando. Aquí se elige y se valida.
const PanelDia = ({ dia, onSecundaria, onComplemento, onAbrirSesion }) => {
  const [abierto, setAbierto] = useState(false);
  const [sep, setSep] = useState(dia.separacionH ?? '');
  const puedeDoblar = DOBLES.turnos[dia.turno]?.permite;
  const infoTurno = DOBLES.turnos[dia.turno];
  const sec = dia.sesionSecundaria;

  // Solo se ofrecen las combinaciones que el plan permite con esta principal
  const opciones = Object.keys(SESION_INFO)
    .filter(k => k !== 'descanso')
    .map(k => ({ k, ...combinacionValida(dia.sesion, k) }))
    .filter(o => o.ok);

  const comp = COMPLEMENTOS.calistenia;
  const compPermitido = comp.permite.includes(dia.sesion);
  const compActivo = (dia.complementos ?? []).includes('calistenia');
  const compCorto = comp.cortaSobre.includes(dia.sesion);
  const valSep = sec ? validarSeparacion(sep === '' ? null : sep, dia.sesion, sec) : null;
  const orden = sec ? ordenDoble(dia.sesion, sec) : null;

  return (
    <div className="mb-4 space-y-2">
      {/* ─── Segunda sesión ya asignada ─── */}
      {sec && (
        <div className="rounded-lg border border-[#232c34] bg-[#151b21] overflow-hidden">
          <button onClick={() => onAbrirSesion(sec)} className="w-full px-3 py-2.5 flex items-center gap-2.5 text-left">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: SESION_INFO[sec].color + '22', border: `1.5px solid ${SESION_INFO[sec].color}` }}>
              <IconFor name={SESION_INFO[sec].icon} size={15} color={SESION_INFO[sec].color} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">Segunda sesión del día</div>
              <div className="text-sm font-bold" style={{ color: SESION_INFO[sec].color }}>{SESION_INFO[sec].label}</div>
            </div>
            <ChevronRight size={16} className="text-slate-500 flex-shrink-0" />
          </button>
          <div className="px-3 pb-3 space-y-2">
            {dia.franjaSecundaria && (
              <p className="text-[11px] text-cyan-300">Piscina a las {dia.franjaSecundaria.hora}:00{dia.franjaSecundaria.guiado ? ' · guiado' : ''}</p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">Separación</span>
              <NumInput value={sep} onChange={(v) => { setSep(v); onSecundaria(dia.fecha, sec, v === '' ? null : parseFloat(v)); }} placeholder="h" w="w-14" etiqueta="Separación entre sesiones" />
              <span className="text-[10px] text-slate-500">horas</span>
            </div>
            {valSep && (
              <p className={`text-[11px] leading-relaxed ${valSep.nivel === 'aviso' ? 'text-amber-300' : valSep.nivel === 'sin_dato' ? 'text-slate-500' : 'text-emerald-300'}`}>
                {valSep.texto}
              </p>
            )}
            {!valSep?.ordenLibre && orden && (
              <p className="text-[10px] text-slate-500">
                Orden: <span className="font-bold text-slate-300">{SESION_INFO[orden.primero].label}</span> primero,
                después {SESION_INFO[orden.despues].label}.
              </p>
            )}
            {dia.dobleCondicional && (
              <p className="text-[11px] text-amber-300">Posturno: {DOBLES.turnos.P.condicion}.</p>
            )}
            {dia.secundariaManual && (
              <button onClick={() => { onSecundaria(dia.fecha, null, null); setSep(''); }}
                className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <X size={11} /> Quitar la segunda sesión
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── Añadir segunda sesión ─── */}
      {!sec && dia.sesion !== 'descanso' && (
        puedeDoblar ? (
          <div className="rounded-lg border border-[#232c34] bg-[#151b21]">
            <button onClick={() => setAbierto(!abierto)} className="w-full px-3 py-2.5 flex items-center gap-2 text-[11px] font-bold uppercase text-slate-300">
              <Zap size={13} className="text-slate-400" /> Añadir segunda sesión
              <ChevronRight size={14} className={`ml-auto text-slate-500 transition-transform ${abierto ? 'rotate-90' : ''}`} />
            </button>
            {abierto && (
              <div className="px-3 pb-3 space-y-2">
                {infoTurno.condicional && (
                  <p className="text-[10px] text-amber-300/90">Posturno: {infoTurno.condicion}. La ventana es corta.</p>
                )}
                <div className="grid grid-cols-2 gap-1.5">
                  {opciones.map(o => (
                    <button key={o.k} onClick={() => { onSecundaria(dia.fecha, o.k, sep === '' ? null : parseFloat(sep)); setAbierto(false); }}
                      className="py-2 px-2 rounded-lg border border-[#2a3540] text-xs font-bold flex items-center gap-2"
                      style={{ color: SESION_INFO[o.k].color }}>
                      <IconFor name={SESION_INFO[o.k].icon} size={13} color={SESION_INFO[o.k].color} />
                      {SESION_INFO[o.k].label}
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-slate-600 leading-relaxed">
                  Solo aparecen las combinaciones que el plan permite con {SESION_INFO[dia.sesion]?.label}.
                  {GYM_PIERNA_UI.includes(dia.sesion) && ' El running no está: pierna + carrera el mismo día viola S3.'}
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-[10px] text-slate-600 px-1">
            No se doblan sesiones en turno {dia.turno}: {infoTurno?.motivo}.
          </p>
        )
      )}

      {/* ─── Complementos ─── */}
      <div className="rounded-lg border border-[#232c34] bg-[#151b21] px-3 py-2.5">
        <div className="text-[10px] uppercase tracking-wide text-slate-500 font-bold mb-2">Complementos</div>
        {compPermitido ? (
          <>
            <button onClick={() => onComplemento(dia.fecha, 'calistenia', !compActivo)}
              className={`w-full py-2 px-2 rounded-lg border-2 text-xs font-bold flex items-center gap-2 transition-all ${compActivo ? '' : 'border-[#2a3540] text-slate-400'}`}
              style={compActivo ? { borderColor: '#a855f7', background: '#a855f722', color: '#a855f7' } : undefined}>
              <IconFor name="home" size={14} color={compActivo ? '#a855f7' : '#64748b'} />
              {compActivo ? 'Calistenia añadida' : 'Añadir calistenia'}
              {compActivo && <Check size={13} className="ml-auto" strokeWidth={3} />}
            </button>
            {compActivo && compCorto && (
              <p className="text-[10px] text-amber-300 mt-2">Sobre un día de descanso, solo la versión corta: sin bloque de pierna.</p>
            )}
          </>
        ) : (
          <p className="text-[11px] text-slate-500 leading-relaxed">
            <span className="font-bold text-slate-400">Calistenia bloqueada hoy.</span> {comp.motivoBloqueo}
          </p>
        )}
      </div>
    </div>
  );
};

// ═══════════════ SESSION VIEW ═══════════════
const SessionView = ({ diaData, sesionKey, ejerciciosVigentes, huerfanos = [], onEditarRutina, rutinaEditada, progress, prMap, onBack, onToggleSet, onLog, onLastre, onBanda, onReset, restTimer, onSkipTimer, avisosReset = {}, onSueno, onSecundaria, onComplemento, onAbrirSesion, esSecundaria, css, onCSS, onFlexible, onConvertirFlexible }) => {
  const ses = SESIONES[sesionKey];
  const color = ses.color;
  // Los ejercicios salen de la rutina VIGENTE en esta fecha, no de la base:
  // una sesión que entrenaste en septiembre conserva lo que hiciste entonces.
  const listaEj = ejerciciosVigentes ?? ses.ejercicios;
  const dayProg = progress || VACIO;

  const total = listaEj.length;
  const completed = useMemo(() => listaEj.filter(ex => {
    const sc = typeof ex.series === 'number' ? ex.series : 1;
    const p = dayProg[ex.id];
    return sc > 0 && p?.sets?.length === sc && p.sets.every(Boolean);
  }).length, [listaEj, dayProg]);

  const done = total > 0 && completed === total;
  // Las horas de sueño no cuentan como "progreso": si contaran, anotar el sueño
  // haría aparecer el botón de Reset en una sesión donde no has marcado nada.
  const anyProgress = Object.keys(dayProg).some(k => !k.startsWith('__'));

  // v6: agrupar por Parte 1 / 2 / 3 / Finisher, respetando el orden del plan
  const grupos = useMemo(() => {
    const orden = [1, 2, 3, 'finisher'];
    const map = new Map();
    listaEj.forEach(ex => {
      const k = ex.parte ?? 1;
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(ex);
    });
    return [...map.entries()].sort((a, b) => orden.indexOf(a[0]) - orden.indexOf(b[0]));
  }, [listaEj]);
  // Natación y running no tienen estructura de Parte 1/2/3: son bloques de una sesión aeróbica.
  // Ni la natación ni el running tienen la estructura Parte 1/2/3 del gimnasio:
  // son bloques de una sesión aeróbica y esas etiquetas ahí no significan nada.
  const esAgua = String(sesionKey).startsWith('nat');
  const mostrarPartes = grupos.length > 1 && !esAgua && sesionKey !== 'running';
  const s4 = S4(dayProg.__sueno);

  return (
    <div className="min-h-screen bg-[#0f1417]">
      <header className="sticky top-0 z-30 bg-[#0f1417]/95 backdrop-blur border-b border-[#232c34]">
        <div className="px-4 py-3">
          <button onClick={onBack} className="flex items-center gap-1.5 text-slate-400 text-xs font-bold uppercase tracking-wide mb-2">
            <ArrowLeft size={14} /> Calendario
          </button>
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + '22', border: `2px solid ${color}` }}>
              <IconFor name={SESION_INFO[sesionKey]?.icon} size={20} color={color} />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-slate-50 leading-none">{ses.nombre}</h1>
              <div className="text-[11px] uppercase tracking-wide mt-1 font-medium" style={{ color }}>
                {mesDeISO(diaData.fecha)} {diaData.dia} · {diaData.sem} · {diaData.momento}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">{ses.subtitulo}</div>
            </div>
          </div>
          {total > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">
                  {completed}/{total} ejercicios {done && '· completo'}
                </span>
                {anyProgress && (
                  <button onClick={onReset} className="flex items-center gap-1 text-[10px] uppercase text-slate-500 font-bold">
                    <RotateCcw size={10} /> Reset
                  </button>
                )}
              </div>
              <div className="h-1.5 bg-[#1a222a] rounded-full overflow-hidden">
                <div className="h-full transition-all duration-500" style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%`, background: done ? '#22c55e' : color }} />
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="px-4 py-4 max-w-2xl mx-auto pb-32">
        {/* Aviso de festivo */}
        {diaData.festivo && (
          <div className="mb-3 px-3 py-2.5 rounded-lg border-l-4 border-rose-500 bg-rose-950/20 flex items-start gap-2">
            <Star size={15} className="text-rose-400 flex-shrink-0 mt-0.5" fill="currentColor" />
            <p className="text-[12px] text-rose-200 leading-relaxed">
              <span className="font-bold">Día festivo en Colombia.</span>
              {sesionKey === 'natacion'
                ? ' La piscina universitaria está cerrada hoy. Cambia a running, calistenia o descanso desde el modo edición.'
                : ' La piscina universitaria está cerrada, pero el gym y las demás sesiones no se afectan.'}
            </p>
          </div>
        )}

        {/* Regla S4 · horas de sueño en posturno */}
        {diaData.turno === 'P' && (
          <div className={`mb-3 px-3 py-2.5 rounded-lg border-l-4 ${s4 ? s4.borde : 'border-slate-500'} ${s4 ? s4.fondo : 'bg-slate-800/20'}`}>
            <div className="flex items-center gap-2 flex-wrap">
              <Moon size={15} className="text-slate-300 flex-shrink-0" />
              <span className="text-[11px] uppercase tracking-wide text-slate-300 font-bold">¿Cuánto dormiste?</span>
              <NumInput value={dayProg.__sueno} onChange={(v) => onSueno(v === '' ? null : parseFloat(v))} placeholder="h" w="w-14" etiqueta="Horas de sueño" />
              <span className="text-[10px] text-slate-500">horas</span>
            </div>
            <p className={`text-[11px] leading-relaxed mt-2 ${s4 ? '' : 'text-slate-400'}`} style={s4 ? { color: s4.color } : undefined}>
              {s4 ? s4.texto : 'La regla S4 depende de este dato: menos de 5h → descanso · 5-6h → sesión reducida · más de 6h → normal.'}
            </p>
          </div>
        )}

        {/* Franja de piscina asignada (v6 · asignación flexible N5) */}
        {diaData.franja && (
          <div className="mb-3 px-3 py-2.5 rounded-lg border-l-4 border-cyan-500 bg-cyan-950/20 flex items-start gap-2">
            <Clock size={15} className="text-cyan-400 flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-cyan-100 leading-relaxed">
              <span className="font-bold">Piscina a las {diaData.franja.hora}:00–{diaData.franja.hora + PISCINA_DURACION_MIN / 60}:00</span>
              {diaData.franja.guiado
                ? ' · Entrenamiento guiado. Hay coach: aprovéchalo para técnica.'
                : ' · Práctica libre (no había franja guiada compatible con este turno).'}
            </p>
          </div>
        )}

        {/* Semana de descarga · P4. Se avisa EL DÍA, no solo en el resumen semanal */}
        {diaData.descarga && (
          <div className="mb-3 px-3 py-2.5 rounded-lg border-l-4 border-violet-500 bg-violet-950/25 flex items-start gap-2">
            <Moon size={15} className="text-violet-300 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-violet-100 leading-relaxed">
              <span className="font-bold">Semana {diaData.semanaBloque} del bloque: DESCARGA (P4).</span> Hoy haces
              la <span className="font-bold">mitad de las series</span> y dejas <span className="font-bold">2 repeticiones más en el tanque</span> (RIR +2).
              No se doblan sesiones esta semana (D3): si algo no cupo, se propone en el día flexible.
              Prioriza dormir — la descarga es donde se consolida lo de las siete semanas anteriores.
            </p>
          </div>
        )}

        {/* Día flexible · las tres condiciones */}
        {!esSecundaria && diaData.flexible && onFlexible && (
          <PanelFlexible dia={diaData} respuesta={diaData.flexRespuesta}
            onResponder={onFlexible} onConvertir={onConvertirFlexible} />
        )}

        {/* D5 · con poco sueño, la segunda sesión del día se propone saltar */}
        {!esSecundaria && diaData.sesionSecundaria && dayProg.__sueno != null && Number(dayProg.__sueno) < 6 && (
          <div className="mb-3 px-3 py-2.5 rounded-lg border-l-4 border-amber-500 bg-amber-950/25 flex items-start gap-2">
            <AlertTriangle size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-100 leading-relaxed">
              <span className="font-bold">Dormiste {dayProg.__sueno}h (D5).</span> Con menos de 6h, sáltate la segunda
              sesión de hoy. Doblar con déficit de sueño no te da adaptación, te da fatiga acumulada.
            </p>
          </div>
        )}

        {/* CSS · calculadora en el test, tabla de ritmos en toda sesión de agua */}
        {esAgua && <PanelCSS css={css} onCSS={onCSS} esTest={sesionKey === 'natCSS'} />}

        {/* Segunda sesión y complementos · solo desde la sesión PRINCIPAL del día */}
        {!esSecundaria && onSecundaria && (
          <PanelDia dia={diaData} onSecundaria={onSecundaria} onComplemento={onComplemento} onAbrirSesion={onAbrirSesion} />
        )}

        {/* Chequeo */}
        <div className="mb-4 px-3 py-2.5 rounded-lg border-l-4 bg-[#151b21]" style={{ borderColor: color }}>
          <p className="text-[12px] text-slate-300 leading-relaxed">{ses.chequeo}</p>
        </div>

        {/* Registro de ejercicios que YA NO están en la rutina. No se borra nunca:
            se enseña aparte para que nada desaparezca en silencio. */}
        {huerfanos.length > 0 && (
          <div className="mb-4 px-3 py-2.5 rounded-lg border-l-4 border-slate-500 bg-slate-800/20">
            <p className="text-[11px] text-slate-300 leading-relaxed">
              <span className="font-bold">{huerfanos.length} ejercicio(s) registrados que ya no están en tu rutina:</span>{' '}
              {huerfanos.join(', ')}. Se conservan aquí para que el historial no se pierda.
            </p>
          </div>
        )}

        {/* Aviso de acarreo · reglas E9 + P2 (las viejas R3 y R4 se eliminaron en la v6) */}
        {listaEj.some(e => e.acarreo) && (
          <div className="mb-4 px-3 py-2 rounded-lg border-l-4 border-cyan-600 bg-cyan-950/20 flex items-start gap-2">
            <AlertTriangle size={14} className="text-cyan-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-cyan-200/90 leading-relaxed">
              Un solo acarreo por sesión (E9). Progresas en <span className="font-bold">carga</span> mientras aguantes 30 m con postura perfecta; en cuanto te inclines, te encorves o des pasos raros, bajas el peso (P2). Semanas 1-3: deliberadamente ligero (L1).
            </p>
          </div>
        )}

        {total === 0 ? (
          <div className="text-center py-16">
            <Moon size={40} className="text-slate-600 mx-auto mb-3" />
            <h2 className="text-2xl font-bold text-slate-300 mb-2">Día de descanso</h2>
            <p className="text-sm text-slate-500 max-w-xs mx-auto">El sueño es tu factor limitante real. Hoy recuperas. Máximo unos dead hangs suaves si te apetece.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {grupos.map(([parte, ejs]) => (
              <div key={parte} className="space-y-2.5">
                {PARTES[parte] && mostrarPartes && (
                  <div className="px-1">
                    <h2 className="text-[11px] font-bold uppercase tracking-wide" style={{ color }}>{PARTES[parte].label}</h2>
                    <p className="text-[10px] text-slate-600 leading-tight">{PARTES[parte].desc}</p>
                  </div>
                )}
                {ejs.map(ex => (
                  <ExerciseCard key={ex.id} ex={ex} prog={dayProg[ex.id]} pr={prMap[ex.id]}
                    onToggleSet={onToggleSet} onLog={onLog} onLastre={onLastre} onBanda={onBanda} color={color}
                    avisoReset={avisosReset[ex.id]} />
                ))}
              </div>
            ))}
          </div>
        )}

        {onEditarRutina && total > 0 && (
          <button onClick={() => onEditarRutina(sesionKey)}
            className="w-full mt-4 py-2.5 rounded-lg border border-[#2a3540] text-slate-400 text-[11px] font-bold uppercase flex items-center justify-center gap-1.5">
            <Settings size={13} /> Editar esta rutina
            {rutinaEditada && <span className="text-amber-400 normal-case font-normal">· editada</span>}
          </button>
        )}

        {done && total > 0 && (
          <div className="mt-6 rounded-xl border-2 border-emerald-600/50 bg-gradient-to-br from-emerald-950/40 to-[#0f1417] p-5 text-center">
            <Trophy size={32} className="text-emerald-400 mx-auto mb-2" />
            <h3 className="text-xl font-bold text-slate-50">Sesión completada</h3>
            <p className="text-sm text-slate-400 mt-1">Buen trabajo. Recupera: proteína + sueño. Nos vemos la próxima.</p>
          </div>
        )}
      </main>

      <RestTimer timer={restTimer} onSkip={onSkipTimer} color={color} />
    </div>
  );
};

// ═══════════════ EDIT DAY MODAL ═══════════════
const EditModal = ({ dia, onSave, onLiberar, onClose, ejerciciosRegistrados = 0 }) => {
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
            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(SESION_INFO).map(([k, v]) => (
                <button key={k} onClick={() => setSesion(k)}
                  className={`py-2 px-2 rounded-lg border-2 text-xs font-bold flex items-center gap-2 transition-all ${sesion === k ? '' : 'border-[#2a3540] text-slate-400'}`}
                  style={{ borderColor: sesion === k ? v.color : undefined, background: sesion === k ? v.color + '22' : undefined, color: sesion === k ? v.color : undefined }}>
                  <IconFor name={v.icon} size={14} color={sesion === k ? v.color : '#64748b'} />
                  {v.label}
                </button>
              ))}
            </div>
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

// ═══════════════ CALENDAR VIEW ═══════════════
// ═══════════════ VOLUMEN POR GRUPO MUSCULAR (v6 · 7.2) ═══════════════
// Series efectivas = (series × 1.0 si primario) + (series × 0.5 si secundario).
// Los secundarios a mitad es la convención de la literatura de volumen: contarlos
// enteros infla el dorsal y los erectores, que aparecen en casi todo.
// Ventana SEMANAL, porque la franja objetivo (8-12 series por grupo) es semanal.
const VolumenMuscular = ({ calendario, progress, todayISO, rutina = {} }) => {
  // Semanas lunes→domingo, derivadas del campo `sem` para respetar las ediciones manuales.
  const semanas = useMemo(() => {
    const out = []; let cur = [];
    calendario.forEach(d => {
      cur.push(d);
      if (d.sem === 'Dom') { out.push(cur); cur = []; }
    });
    if (cur.length) out.push(cur);
    return out;
  }, [calendario]);

  // Si hoy no cae en el mes que se está mirando, se abre por la primera semana
  // (no por la última) y NO se etiqueta ninguna como "semana actual".
  const semanaDeHoy = useMemo(
    () => semanas.findIndex(s => s.some(d => d.fecha === todayISO)),
    [semanas, todayISO]
  );
  const semanaInicial = semanaDeHoy === -1 ? 0 : semanaDeHoy;

  const [idx, setIdx] = useState(semanaInicial);
  const [cat, setCat] = useState('todos');
  // Al cambiar de mes hay que volver a la semana inicial. Hacerlo con un useEffect
  // que llama a setIdx pinta primero la semana vieja y luego corrige: un render de
  // más con datos equivocados. El ajuste durante el render es el patrón que React
  // documenta para esto — descarta el render en curso y rehace sin llegar a pintar.
  // Se compara el MES, no el índice: dos meses distintos pueden compartir índice
  // inicial (0 en ambos) y entonces no se resetearía la semana elegida.
  const mesActual = calendario[0]?.fecha.slice(0, 7) ?? '';
  const [mesVisto, setMesVisto] = useState(mesActual);
  if (mesVisto !== mesActual) {
    setMesVisto(mesActual);
    setIdx(semanaInicial);
  }

  const semana = useMemo(() => semanas[Math.min(idx, semanas.length - 1)] || [], [semanas, idx]);

  const datos = useMemo(() => {
    const plan = {}, hecho = {};
    const add = (acc, m, v) => { acc[m] = (acc[m] || 0) + v; };

    semana.forEach(d => {
      const claves = [
        d.sesion === 'natacion' ? (d.variante ?? 'natacion') : d.sesion,
        d.sesionSecundaria === 'natacion' ? (d.varianteSecundaria ?? 'natacion') : d.sesionSecundaria,
        ...(d.complementos ?? []),
      ].filter(Boolean);
      const pDia = progress[d.fecha] || {};
      claves.flatMap(k => resolverRutina(k, d.fecha, rutina)).forEach(ex => {
        if (!ex.musculos || typeof ex.series !== 'number' || ex.series === 0) return;
        // Planificadas = solo lo no opcional: los `*` son lo primero que se recorta (R2),
        // así que son suelo comprometido, no promesa.
        const sPlan = ex.opcional ? 0 : ex.series;
        const sHecho = pDia[ex.id]?.sets?.filter(Boolean).length || 0;
        ex.musculos.primario.forEach(m => { add(plan, m, sPlan); add(hecho, m, sHecho); });
        ex.musculos.secundario.forEach(m => { add(plan, m, sPlan * 0.5); add(hecho, m, sHecho * 0.5); });
      });
    });

    const filas = Object.keys({ ...plan, ...hecho })
      .filter(m => MUSCULOS[m] && ((plan[m] || 0) > 0 || (hecho[m] || 0) > 0))
      .filter(m => cat === 'todos' || MUSCULOS[m].cat === cat)
      .map(m => ({ m, ...MUSCULOS[m], plan: +(plan[m] || 0).toFixed(1), hecho: +(hecho[m] || 0).toFixed(1) }))
      .sort((a, b) => b.plan - a.plan || b.hecho - a.hecho);

    // Escala FIJA (2× el tope de la franja objetivo). Si fuera adaptativa, la franja
    // 8-12 se movería de semana a semana y se perdería la lectura de un vistazo.
    // Lo que se salga se recorta visualmente; el número y el ▲ dicen cuánto es.
    const escala = RANGO_VOLUMEN.objetivoMax * 2;
    return { filas, escala };
  }, [semana, progress, cat, rutina]);

  const rango = (v) => v === 0 ? 'cero' : v < RANGO_VOLUMEN.min ? 'bajo' : v > RANGO_VOLUMEN.max ? 'alto' : 'ok';
  const colorRango = { cero: '#475569', bajo: '#f59e0b', alto: '#f59e0b', ok: '#94a3b8' };

  const dias = semana.map(d => d.dia);
  const etiqueta = dias.length
    ? (dias.length === 1 ? `Día ${dias[0]}` : `${dias[0]} – ${dias[dias.length - 1]} de ${mesDeISO(semana[0].fecha)}`)
    : '—';

  return (
    <div className="rounded-xl border border-[#232c34] bg-[#151b21] p-3.5 mt-2.5">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">Volumen por grupo muscular</div>
        <div className="flex items-center gap-1">
          <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}
            className="w-6 h-6 rounded flex items-center justify-center text-slate-400 disabled:text-slate-700 border border-[#232c34]">
            <ChevronLeft size={13} />
          </button>
          <button onClick={() => setIdx(i => Math.min(semanas.length - 1, i + 1))} disabled={idx >= semanas.length - 1}
            className="w-6 h-6 rounded flex items-center justify-center text-slate-400 disabled:text-slate-700 border border-[#232c34]">
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
      <div className="text-[11px] text-slate-400 font-medium mb-3">
        {etiqueta}
        {idx === semanaDeHoy && semanaDeHoy !== -1 && <span className="ml-1.5 text-[9px] uppercase tracking-wide text-slate-500">· semana actual</span>}
      </div>

      {/* Filtro por categoría */}
      <div className="flex gap-1 mb-3 flex-wrap">
        {[['todos', 'Todos', '#94a3b8'], ...Object.entries(CAT_MUSCULO).map(([k, v]) => [k, v.label, v.color])].map(([k, label, c]) => (
          <button key={k} onClick={() => setCat(k)}
            className={`text-[9px] font-bold uppercase tracking-wide px-2 py-1 rounded border transition-all ${cat === k ? '' : 'border-[#232c34] text-slate-500'}`}
            style={cat === k ? { background: c + '22', borderColor: c + '88', color: c } : undefined}>
            {label}
          </button>
        ))}
      </div>

      {datos.filas.length === 0 ? (
        <p className="text-[11px] text-slate-600 py-3 text-center">Sin volumen registrado ni planificado en esta semana.</p>
      ) : (
        <>
          <div className="space-y-2">
            {datos.filas.map(f => {
              const wPlan = Math.min(100, (f.plan / datos.escala) * 100);
              const wHecho = Math.min(100, (f.hecho / datos.escala) * 100);
              const r = rango(f.plan);
              const excede = f.plan > datos.escala;
              return (
                <div key={f.m}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[11px] font-medium text-slate-300">{f.label}</span>
                    <span className="text-[10px] font-bold" style={{ fontFamily: 'ui-monospace, monospace' }}>
                      <span style={{ color: f.hecho > 0 ? f.color : '#475569' }}>{f.hecho}</span>
                      <span className="text-slate-600"> / {f.plan}</span>
                      {(r === 'bajo' || r === 'alto') && (
                        <span className="ml-1" style={{ color: colorRango[r] }}>{r === 'bajo' ? '▼' : '▲'}</span>
                      )}
                    </span>
                  </div>
                  <div className="relative h-2 bg-[#0f1417] rounded-full overflow-hidden">
                    {/* Franja objetivo 8-12, al fondo */}
                    <div className="absolute inset-y-0 pointer-events-none"
                      style={{
                        left: `${(RANGO_VOLUMEN.objetivoMin / datos.escala) * 100}%`,
                        width: `${((RANGO_VOLUMEN.objetivoMax - RANGO_VOLUMEN.objetivoMin) / datos.escala) * 100}%`,
                        background: 'rgba(226,232,240,0.10)',
                        boxShadow: 'inset 1px 0 0 rgba(226,232,240,0.30), inset -1px 0 0 rgba(226,232,240,0.30)',
                      }} />
                    {/* Planificado (translúcido) */}
                    <div className="absolute inset-y-0 left-0" style={{ width: `${wPlan}%`, background: f.color, opacity: 0.25 }} />
                    {/* Hecho (sólido) */}
                    <div className="absolute inset-y-0 left-0" style={{ width: `${wHecho}%`, background: f.color, transition: 'width 0.6s ease' }} />
                    {/* Marca de recorte: el volumen se sale de la escala */}
                    {excede && <div className="absolute inset-y-0 right-0 w-1" style={{ background: colorRango.alto }} />}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 pt-2.5 border-t border-[#232c34] space-y-1">
            <p className="text-[9px] text-slate-600 leading-relaxed">
              Series efectivas: primario ×1 · secundario ×0.5. Sólido = hechas · translúcido = planificadas (sin contar los <span className="font-bold">*</span>).
            </p>
            <p className="text-[9px] text-slate-600 leading-relaxed">
              La banda clara marca la franja productiva de {RANGO_VOLUMEN.objetivoMin}-{RANGO_VOLUMEN.objetivoMax} series/semana para tu nivel.
              ▼ por debajo de {RANGO_VOLUMEN.min} · ▲ por encima de {RANGO_VOLUMEN.max}. La escala llega a {RANGO_VOLUMEN.objetivoMax * 2}: lo que se pase se recorta con una marca ámbar a la derecha.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

const CalendarView = ({ calendario, progress, onOpenDay, onEditDay, editMode, setEditMode,
  todayISO, saveStatus, mesInfo, onMes, avisos, onExportar, onImportar, mensajeDatos, hayMesAnterior, rutina = {} }) => {
  const dayCompletion = useCallback((d) => {
    // Un día puede tener principal + secundaria + complementos: para estar
    // "completo" tienen que estarlo todos. Cada uno se marca por separado.
    const claves = [
      d.sesion === 'natacion' ? (d.variante ?? 'natacion') : d.sesion,
      d.sesionSecundaria === 'natacion' ? (d.varianteSecundaria ?? 'natacion') : d.sesionSecundaria,
      ...(d.complementos ?? []),
    ].filter(Boolean);
    const ejercicios = claves.flatMap(k => resolverRutina(k, d.fecha, rutina));
    if (!ejercicios.length) return 'none';
    const p = progress[d.fecha] || {};
    const total = ejercicios.length;
    const done = ejercicios.filter(ex => {
      const sc = typeof ex.series === 'number' ? ex.series : 1;
      const pr = p[ex.id];
      return sc > 0 && pr?.sets?.length === sc && pr.sets.every(Boolean);
    }).length;
    if (done === 0) return 'none';
    if (done === total) return 'full';
    return 'partial';
  }, [progress, rutina]);

  // ─── Estadísticas del mes ───
  const stats = useMemo(() => {
    // Días entrenables = los que tienen sesión con ejercicios (no descanso)
    const entrenables = calendario.filter(d => {
      const s = SESIONES[d.sesion];
      return s && s.ejercicios.length > 0;
    });
    const totalEntrenables = entrenables.length;

    let completadas = 0, parciales = 0;
    // Desglose por categoría
    const cats = { gym: 0, cardio: 0, calistenia: 0 };
    const catsTotal = { gym: 0, cardio: 0, calistenia: 0 };

    const catOf = (sesion) => {
      if (sesion.startsWith('gym')) return 'gym';
      if (sesion === 'natacion' || sesion === 'running') return 'cardio';
      if (sesion === 'calistenia') return 'calistenia';
      return null;
    };

    entrenables.forEach(d => {
      const c = catOf(d.sesion);
      if (c) catsTotal[c]++;
      const comp = dayCompletion(d);
      if (comp === 'full') { completadas++; if (c) cats[c]++; }
      else if (comp === 'partial') parciales++;
    });

    // Racha: días completados consecutivos hacia atrás desde hoy (o desde el último día con actividad)
    // Contamos sobre días entrenables; los de descanso no rompen la racha.
    let racha = 0;
    const ref = todayISO;
    const ordenados = [...calendario].filter(d => d.fecha <= ref).sort((a, b) => b.fecha.localeCompare(a.fecha));
    for (const d of ordenados) {
      const ses = SESIONES[d.sesion];
      const esDescanso = !ses || ses.ejercicios.length === 0;
      if (esDescanso) continue; // descanso no rompe ni suma
      if (dayCompletion(d) === 'full') racha++;
      else break;
    }

    const pct = totalEntrenables > 0 ? Math.round((completadas / totalEntrenables) * 100) : 0;
    return { totalEntrenables, completadas, parciales, pct, racha, cats, catsTotal };
  // `progress` no va en las dependencias: ya entra a través de dayCompletion,
  // que es un useCallback sobre [progress].
  }, [calendario, dayCompletion, todayISO]);


  return (
    <div className="min-h-screen bg-[#0f1417]">
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
                Exporta un archivo con tu progreso, cargas, PRs y días fijados. Importar <span className="font-bold">reemplaza</span> lo que haya en este dispositivo.
              </p>
              {mensajeDatos && (
                <p className={`text-[10px] mt-1.5 font-bold ${mensajeDatos.ok ? 'text-emerald-400' : 'text-red-400'}`}>{mensajeDatos.texto}</p>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="px-2 py-4 max-w-2xl mx-auto pb-24">
        {/* Leyenda de turnos */}
        <div className="flex items-center gap-3 justify-center mb-4 flex-wrap px-2">
          {Object.entries(TURNO_INFO).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: v.color }} />
              <span className="text-[10px] text-slate-500 uppercase tracking-wide">{v.label}</span>
            </div>
          ))}
        </div>

        {/* Cabecera de días de la semana */}
        <div className="grid grid-cols-7 gap-1 mb-1 px-1">
          {DIAS_SEMANA.map((d, i) => (
            <div key={i} className="text-center text-[9px] sm:text-[10px] font-bold uppercase tracking-wide text-slate-500 py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Cuadrícula del calendario */}
        <div className="grid grid-cols-7 gap-1 px-1">
          {/* Celdas vacías antes del día 1 */}
          {Array.from({ length: mesInfo.primerDiaSemana }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}

          {/* Días del mes */}
          {calendario.map(d => {
            const turno = TURNO_INFO[d.turno];
            // La natación muestra qué sesión de la rotación toca (A1, B2, test…)
            const claveVista = d.sesion === 'natacion' ? (d.variante ?? 'natacion') : d.sesion;
            const ses = SESION_INFO[claveVista] ?? SESION_INFO[d.sesion];
            const comp = dayCompletion(d);
            const hecho = comp === 'full';
            const isToday = todayISO === d.fecha;
            // Día hecho: marco encendido del color de la sesión (ver COMPLETADO arriba)
            const estiloHecho = {
              background: hexARgba(ses.color, COMPLETADO.alphaFondo),
              borderStyle: 'solid',
              borderColor: ses.color,
              borderWidth: COMPLETADO.borde,
              borderTopWidth: COMPLETADO.bordeSuperior,
              padding: COMPLETADO.padding,
            };
            return (
              <button key={d.fecha}
                onClick={() => editMode ? onEditDay(d) : onOpenDay(d)}
                className={`relative aspect-square rounded-lg border p-1 flex flex-col transition-all ${
                  isToday ? 'border-slate-300 bg-[#1a222a] ring-1 ring-slate-400/50' : 'border-[#232c34] bg-[#151b21] active:bg-[#1a222a]'
                }`}
                style={hecho ? estiloHecho : { borderTopColor: turno.color, borderTopWidth: '3px' }}>

                {/* Número del día + turno. La letra del turno conserva SU color aunque el
                    borde superior pase al de la sesión: el dato del turno no se pierde. */}
                <div className="flex items-start justify-between leading-none">
                  <span className="text-sm sm:text-base font-bold" style={{ fontFamily: 'ui-monospace, monospace', color: isToday ? '#e2e8f0' : '#cbd5e1' }}>
                    {d.dia}<span className="text-[10px] font-bold" style={{ color: turno.color }}> · {d.turno}</span>
                  </span>
                  {/* Indicador de estado (esquina) */}
                  {!editMode && hecho && <Check size={11} strokeWidth={3} className="flex-shrink-0" style={{ color: ses.color }} />}
                  {!editMode && comp === 'partial' && <Circle size={11} className="text-amber-400 flex-shrink-0" fill="#f59e0b" fillOpacity={0.4} />}
                  {editMode && <Settings size={11} className="text-slate-500 flex-shrink-0" />}
                </div>

                {/* Ícono(s) de sesión. Un día doblado muestra los dos, más pequeños. */}
                <div className="flex-1 flex items-center justify-center gap-0.5">
                  <IconFor name={ses.icon} size={d.sesionSecundaria ? 14 : 18} color={ses.color} />
                  {d.sesionSecundaria && SESION_INFO[d.sesionSecundaria] && (
                    <IconFor name={SESION_INFO[d.sesionSecundaria].icon} size={14}
                      color={SESION_INFO[d.sesionSecundaria].color} />
                  )}
                </div>

                {/* Etiqueta de sesión (abajo) */}
                <div className="text-[7px] sm:text-[8px] font-bold uppercase tracking-tight text-center leading-none truncate"
                  style={{ color: d.sesionSecundaria ? '#94a3b8' : ses.color }}>
                  {d.sesionSecundaria
                    ? `${ses.label.replace('Gym ', '')}+${SESION_INFO[d.sesionSecundaria].label.replace('Gym ', '').slice(0, 3)}`
                    : ses.label}
                </div>
                {/* Punto de complemento apilado */}
                {(d.complementos ?? []).length > 0 && (
                  <span className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full" style={{ background: '#a855f7' }} />
                )}

                {/* Marcadores de esquina: hoy y festivo */}
                {isToday && (
                  <span className="absolute -top-1 -right-1 text-[7px] font-bold uppercase px-1 py-0.5 rounded-full bg-slate-200 text-slate-900 leading-none">Hoy</span>
                )}
                {d.festivo && (
                  <span className="absolute -top-1 -left-1 w-3.5 h-3.5 rounded-full bg-rose-500 flex items-center justify-center">
                    <Star size={8} className="text-white" fill="currentColor" />
                  </span>
                )}
                {/* Día fijado A MANO: el generador lo respeta y calcula el resto alrededor.
                    Los fijados automáticamente (por tener registro) no se marcan: ya se
                    distinguen por el check de completado y marcarlos sería ruido. */}
                {d.fijado && !d.fijadoAuto && !d.festivo && (
                  <span className="absolute -top-1 -left-1 w-3.5 h-3.5 rounded-full bg-amber-500 flex items-center justify-center">
                    <Settings size={8} className="text-slate-900" strokeWidth={3} />
                  </span>
                )}
                {/* Día flexible del cupo semanal */}
                {d.flexible && !d.fijado && !d.festivo && (
                  <span className="absolute bottom-0 left-0.5 text-[7px] font-bold text-slate-600 leading-none">flex</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Avisos del generador (natación imposible, running tras pierna…) */}
        {avisos?.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {avisos.map((a, i) => (
              <div key={i} className="px-3 py-2 rounded-lg border-l-4 border-amber-600 bg-amber-950/20 flex items-start gap-2">
                <AlertTriangle size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-100/90 leading-relaxed">{a.texto}</p>
              </div>
            ))}
          </div>
        )}

        {/* ═══ PANEL DE ESTADÍSTICAS ═══ */}
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
          <VolumenMuscular calendario={calendario} progress={progress} todayISO={todayISO} rutina={rutina} />
        </div>

        {/* Nota inferior */}
        <p className="text-center text-[10px] text-slate-600 mt-4 px-4">
          Toca un día para ver o registrar tu entrenamiento{editMode ? '' : ''}
        </p>
      </main>
    </div>
  );
};

// ═══════════════ MAIN APP ═══════════════
export default function App() {
  const todayISO = hoyISO();

  // ─── Estado del generador v6 ───
  // El calendario ya NO es estado: es una función pura de (ancla, fijados, festivos).
  // Guardar el array generado sería duplicar la verdad y arriesgarse a que se
  // desincronice del ancla; lo que se persiste son las ENTRADAS.
  const [ancla, setAncla] = useState(() => estadoGuardado().ancla ?? ANCLA_DEFAULT);
  const [fijados, setFijados] = useState(() => estadoGuardado().fijados);   // { fecha: { turno, sesion, auto? } }
  const [festivos, setFestivos] = useState(() => estadoGuardado().festivos ?? FESTIVOS_DEFAULT);
  // Lo que el usuario añade sobre el día generado: segunda sesión y complementos.
  // Va aparte de `fijados` porque no cambia la sesión principal ni la cola de gym.
  const [extras, setExtras] = useState(() => estadoGuardado().extras ?? {});
  const [css, setCss] = useState(() => estadoGuardado().css ?? null);   // segundos por 100 m
  // Versiones de rutina encima del plan base. El pasado no se reescribe.
  const [rutina, setRutina] = useState(() => estadoGuardado().rutina ?? {});
  const [editandoRutina, setEditandoRutina] = useState(null);   // clave de sesión
  // Año y mes viven en UN SOLO estado. Separados, cruzar el 31 de diciembre obliga
  // a llamar a setAnio dentro del updater de setMes, y React ignora ese setState
  // (los updaters tienen que ser puros): el mes saltaba a enero y el año se quedaba
  // atrás, dejando al usuario en un mes anterior al ancla y rompiendo la pantalla.
  const [cursor, setCursor] = useState(() => ({
    anio: Number(todayISO.slice(0, 4)),
    mes: Number(todayISO.slice(5, 7)) - 1,
  }));
  const { anio, mes } = cursor;

  const { dias: generado, avisos } = useMemo(
    () => generarMes({ anio, mes, ancla, fijados, festivos }),
    [anio, mes, ancla, fijados, festivos]
  );
  // Se fusiona lo que añadió el usuario sobre lo que produjo el generador.
  const calendario = useMemo(() => generado.map(d => {
    const ex = extras[d.fecha];
    if (!ex) return d;
    return {
      ...d,
      sesionSecundaria: ex.secundaria ?? d.sesionSecundaria,
      secundariaManual: !!ex.secundaria,
      separacionH: ex.separacionH,
      complementos: ex.complementos ?? [],
      flexRespuesta: ex.flex,
    };
  }), [generado, extras]);
  const mesInfo = useMemo(() => infoMes(anio, mes), [anio, mes]);

  const [progress, setProgress] = useState(() => estadoGuardado().prog); // { 'YYYY-MM-DD': { exId: {sets,logs} } }
  const [prMap, setPrMap] = useState(() => estadoGuardado().prs);        // { exId: {kg, flash} }
  const [view, setView] = useState('calendar'); // calendar | session
  const [activeFecha, setActiveFecha] = useState(null);
  const [activeSesion, setActiveSesion] = useState(null);   // null = la principal del día
  // Se calcula aquí arriba porque las mutaciones de progreso lo necesitan para
  // fijar el día automáticamente al registrar la primera serie.
  const diaActivo = useMemo(() => calendario.find(d => d.fecha === activeFecha), [calendario, activeFecha]);
  const [editMode, setEditMode] = useState(false);
  const [editingDay, setEditingDay] = useState(null);
  const [restTimer, setRestTimer] = useState(null);
  const timerRef = useRef(null);

  // ─── Persistencia robusta ───
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved
  const saveTimeoutRef = useRef(null);

  // Estado serializable: se guardan las ENTRADAS del generador, no su salida.
  const snapshot = useCallback(
    () => ({ v: 3, ancla, fijados, festivos, extras, css, rutina, prog: progress, prs: prMap }),
    [ancla, fijados, festivos, extras, css, rutina, progress, prMap]
  );

  const doSave = useCallback((datos) => {
    try {
      localStorage.setItem('plan-internado', JSON.stringify(datos));
      setSaveStatus('saved');
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => setSaveStatus('idle'), 1500);
      return true;
    } catch {
      // Cuota llena o almacenamiento bloqueado (modo privado)
      setSaveStatus('error');
      return false;
    }
  }, []);

  // Guardar cada vez que cambian los datos. Ya no hace falta esperar a "la carga":
  // el estado nace leído de localStorage, así que el primer guardado normaliza
  // directamente a v3 cualquier respaldo antiguo que se haya migrado al arrancar.
  useEffect(() => { doSave(snapshot()); }, [snapshot, doSave]);

  // Guardar también cuando la app se minimiza o se cierra (red de seguridad)
  useEffect(() => {
    const flush = () => {
      try { localStorage.setItem('plan-internado', JSON.stringify(snapshot())); } catch { /* cuota llena o modo privado */ }
    };
    window.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
    };
  }, [snapshot]);

  // ─── Timer ───
  const startTimer = useCallback((secs, name) => {
    if (!secs || timerRef.current) return;
    vibrate(100);
    let left = secs;
    setRestTimer({ secondsLeft: left, total: secs, name, done: false });
    timerRef.current = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(timerRef.current); timerRef.current = null;
        setRestTimer({ secondsLeft: 0, total: secs, name, done: true });
        vibrate([200, 100, 200]); playBeep(); setTimeout(playBeep, 500);
        setTimeout(() => setRestTimer(null), 3000);
      } else setRestTimer(p => p ? { ...p, secondsLeft: left } : null);
    }, 1000);
  }, []);
  const skipTimer = useCallback(() => { if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null; setRestTimer(null); }, []);
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // ─── PR detector ───
  // El updater de setPrMap tiene que ser PURO. Antes llamaba a vibrate() y
  // programaba un setTimeout dentro: React invoca los updaters dos veces en
  // StrictMode, así que vibraba dos veces y dejaba dos temporizadores sueltos.
  // Es el mismo error que el de la navegación de mes. Ahora la comparación se
  // hace contra un ref y los efectos ocurren fuera del updater.
  const prMapRef = useRef(prMap);
  useEffect(() => { prMapRef.current = prMap; }, [prMap]);
  const flashRef = useRef(new Map());
  useEffect(() => () => { flashRef.current.forEach(clearTimeout); flashRef.current.clear(); }, []);

  const checkPR = useCallback((exId, kg) => {
    if (kg == null || isNaN(kg) || kg <= 0) return;
    const cur = prMapRef.current[exId];
    if (cur && kg <= cur.kg) return;
    prMapRef.current = { ...prMapRef.current, [exId]: { kg, flash: true } };
    setPrMap(prev => ({ ...prev, [exId]: { kg, flash: true } }));
    vibrate(400);
    clearTimeout(flashRef.current.get(exId));
    flashRef.current.set(exId, setTimeout(() => {
      flashRef.current.delete(exId);
      setPrMap(p => (p[exId] ? { ...p, [exId]: { ...p[exId], flash: false } } : p));
    }, 4000));
  }, []);

  // ─── Mutaciones de progreso ───
  // En cuanto se registra algo en un día, ese día queda FIJADO automáticamente.
  // Sin esto, editar otro día recalcularía el calendario y podría cambiarle la
  // sesión, dejando el registro con IDs de ejercicios que ya no existen ahí.
  // Fijarlo a su valor actual no altera nada más: la cola de gym se resincroniza
  // a la misma posición en la que ya estaba.
  const fijarPorRegistro = useCallback((dia) => {
    if (!dia) return;
    setFijados(prev => prev[dia.fecha]
      ? prev
      : { ...prev, [dia.fecha]: { turno: dia.turno, sesion: dia.sesion, auto: true } });
  }, []);

  const toggleSet = useCallback((exId, i, setCount, ex) => {
    fijarPorRegistro(diaActivo);
    setProgress(prev => {
      const day = prev[activeFecha] || {};
      const p = day[exId] || { sets: [], logs: [], lastre: null };
      const sets = [...(p.sets || [])];
      const logs = [...(p.logs || [])];
      while (sets.length < setCount) sets.push(false);
      while (logs.length < setCount) logs.push(null);
      const nv = !sets[i];
      sets[i] = nv;
      if (nv && !timerRef.current && ex) { const r = parseRest(ex.descanso); if (r) startTimer(r, ex.nombre); }
      return { ...prev, [activeFecha]: { ...day, [exId]: { ...p, sets, logs } } };
    });
  }, [activeFecha, startTimer, fijarPorRegistro, diaActivo]);

  const onLog = useCallback((exId, i, log, setCount) => {
    fijarPorRegistro(diaActivo);
    setProgress(prev => {
      const day = prev[activeFecha] || {};
      const p = day[exId] || { sets: [], logs: [], lastre: null };
      const logs = [...(p.logs || [])];
      while (logs.length < setCount) logs.push(null);
      logs[i] = log;
      return { ...prev, [activeFecha]: { ...day, [exId]: { ...p, logs } } };
    });
    if (log?.kg != null) checkPR(exId, log.kg);
  }, [activeFecha, checkPR, fijarPorRegistro, diaActivo]);

  const onLastre = useCallback((exId, kg) => {
    fijarPorRegistro(diaActivo);
    setProgress(prev => {
      const day = prev[activeFecha] || {};
      const p = day[exId] || { sets: [], logs: [], lastre: null };
      return { ...prev, [activeFecha]: { ...day, [exId]: { ...p, lastre: kg } } };
    });
    if (kg != null) checkPR(exId, kg);
  }, [activeFecha, checkPR, fijarPorRegistro, diaActivo]);

  const onBanda = useCallback((exId, val) => {
    fijarPorRegistro(diaActivo);
    setProgress(prev => {
      const day = prev[activeFecha] || {};
      const p = day[exId] || { sets: [], logs: [], lastre: null };
      return { ...prev, [activeFecha]: { ...day, [exId]: { ...p, banda: val } } };
    });
  }, [activeFecha, fijarPorRegistro, diaActivo]);

  const resetDay = useCallback(() => {
    setProgress(prev => { const n = { ...prev }; delete n[activeFecha]; return n; });
  }, [activeFecha]);

  // ─── Editar día: FIJAR + recalcular lo que viene ───
  // El calendario se regenera solo, porque es un useMemo sobre `fijados`.
  const saveEdit = useCallback((fecha, turno, sesion, festivo, borrarRegistro) => {
    // Al cambiar de sesión un día con registro, ese registro apunta a ejercicios
    // que ya no existen ahí: se borra (solo tras confirmarlo en el modal).
    if (borrarRegistro) setProgress(prev => { const n = { ...prev }; delete n[fecha]; return n; });
    setFijados(prev => ({ ...prev, [fecha]: { turno, sesion } }));
    setFestivos(prev => festivo
      ? (prev.includes(fecha) ? prev : [...prev, fecha])
      : prev.filter(f => f !== fecha));
    setEditingDay(null);
  }, []);

  // Soltar un día fijado: vuelve a mandar el generador
  const liberarDia = useCallback((fecha) => {
    setFijados(prev => { const n = { ...prev }; delete n[fecha]; return n; });
    setEditingDay(null);
  }, []);

  // ─── Sueño en posturno (regla S4) ───
  const onSueno = useCallback((h) => {
    setProgress(prev => ({ ...prev, [activeFecha]: { ...(prev[activeFecha] || {}), __sueno: h } }));
  }, [activeFecha]);

  // ─── Avisos de reset (regla P6) ───
  const avisosReset = useMemo(() => calcularAvisosReset(progress, SESIONES), [progress]);

  // ─── Exportar / importar JSON ───
  const [mensajeDatos, setMensajeDatos] = useState(null);
  const avisar = useCallback((ok, texto) => {
    setMensajeDatos({ ok, texto });
    setTimeout(() => setMensajeDatos(null), 5000);
  }, []);

  const onExportar = useCallback(() => {
    try {
      const blob = new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `plan-internado-${todayISO}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      avisar(true, 'Exportado. Pásalo al otro dispositivo e impórtalo allí.');
    } catch {
      avisar(false, 'No se pudo exportar en este navegador.');
    }
  }, [snapshot, todayISO, avisar]);

  const onImportar = useCallback((file) => {
    const lector = new FileReader();
    lector.onload = () => {
      try {
        const d = JSON.parse(String(lector.result));
        // Validación mínima: debe parecer un respaldo de esta app, no un JSON cualquiera.
        if (!d || typeof d !== 'object' || (!d.prog && !d.fijados && !d.ancla)) {
          avisar(false, 'Ese archivo no parece un respaldo de la app.');
          return;
        }
        if (d.ancla) setAncla(d.ancla);
        setFijados(d.fijados && typeof d.fijados === 'object' ? d.fijados : {});
        setFestivos(Array.isArray(d.festivos) ? d.festivos : FESTIVOS_DEFAULT);
        setProgress(d.prog && typeof d.prog === 'object' ? d.prog : {});
        setPrMap(d.prs && typeof d.prs === 'object' ? d.prs : {});
        const nDias = Object.keys(d.prog || {}).length;
        avisar(true, `Importado: ${nDias} ${nDias === 1 ? 'día' : 'días'} con registro.`);
      } catch {
        avisar(false, 'El archivo está corrupto o no es JSON válido.');
      }
    };
    lector.onerror = () => avisar(false, 'No se pudo leer el archivo.');
    lector.readAsText(file);
  }, [avisar]);

  // ─── Segunda sesión y complementos ───
  const setExtra = useCallback((fecha, cambio) => {
    setExtras(prev => {
      const actual = prev[fecha] ?? {};
      const nuevo = { ...actual, ...cambio };
      // Si queda vacío se elimina la entrada, para no guardar basura
      const vacio = !nuevo.secundaria && !(nuevo.complementos?.length) && nuevo.separacionH == null && !nuevo.flex;
      const out = { ...prev };
      if (vacio) delete out[fecha]; else out[fecha] = nuevo;
      return out;
    });
  }, []);

  const onSecundaria = useCallback((fecha, sesion, separacionH) =>
    setExtra(fecha, { secundaria: sesion || undefined, separacionH }), [setExtra]);

  const onComplemento = useCallback((fecha, comp, activo) => {
    setExtras(prev => {
      const actual = prev[fecha] ?? {};
      const lista = new Set(actual.complementos ?? []);
      if (activo) lista.add(comp); else lista.delete(comp);
      const nuevo = { ...actual, complementos: [...lista] };
      const vacio = !nuevo.secundaria && !nuevo.complementos.length && nuevo.separacionH == null && !nuevo.flex;
      const out = { ...prev };
      if (vacio) delete out[fecha]; else out[fecha] = nuevo;
      return out;
    });
  }, []);

  // ─── Editor de rutina ───
  const guardarRutina = useCallback((sesionKey, ejercicios, motivo) => {
    setRutina(prev => guardarVersion(prev, sesionKey, ejercicios, todayISO, motivo));
    setEditandoRutina(null);
  }, [todayISO]);
  const restaurarRutina = useCallback((sesionKey) => {
    setRutina(prev => restaurarPlan(prev, sesionKey, todayISO));
    setEditandoRutina(null);
  }, [todayISO]);

  // ─── Día flexible ───
  const onFlexible = useCallback((fecha, cambio) => {
    setExtras(prev => ({ ...prev, [fecha]: { ...(prev[fecha] ?? {}), flex: { ...(prev[fecha]?.flex ?? {}), ...cambio } } }));
  }, []);
  // Convertirlo en running es fijar ese día: el generador lo respetará al recalcular
  const onConvertirFlexible = useCallback((fecha, sesion) => {
    setFijados(prev => ({ ...prev, [fecha]: { ...(prev[fecha] ?? {}), turno: 'C', sesion } }));
  }, []);

  // ─── Navegación de mes ───
  // Aritmética en meses absolutos: cruzar diciembre deja de ser un caso especial.
  const cambiarMes = useCallback((delta) => {
    setCursor(({ anio, mes }) => {
      const total = anio * 12 + mes + delta;
      return { anio: Math.floor(total / 12), mes: ((total % 12) + 12) % 12 };
    });
  }, []);

  // No se puede retroceder más allá del mes del ancla: antes de esa fecha no hay
  // plan que generar y el calendario saldría vacío.
  const hayMesAnterior = useMemo(() => {
    const aAnio = Number(ancla.fecha.slice(0, 4));
    const aMes = Number(ancla.fecha.slice(5, 7)) - 1;
    return anio * 12 + mes > aAnio * 12 + aMes;
  }, [anio, mes, ancla]);

  // ─── Navegación ───
  const openDay = useCallback((d) => { setActiveFecha(d.fecha); setActiveSesion(null); setView('session'); window.scrollTo(0, 0); }, []);
  const abrirSesionDelDia = useCallback((sesion) => { setActiveSesion(sesion); window.scrollTo(0, 0); }, []);
  const backToCalendar = useCallback(() => {
    if (activeSesion) { setActiveSesion(null); return; }   // de la secundaria a la principal
    setView('calendar'); skipTimer();
  }, [skipTimer, activeSesion]);

  const activeDiaData = diaActivo;

  // Clave real de la sesión que se está viendo (natación resuelve a su variante)
  const claveVista = activeDiaData && (activeSesion
    ? (activeSesion === 'natacion' ? (activeDiaData.varianteSecundaria ?? 'natacion') : activeSesion)
    : (activeDiaData.sesion === 'natacion' ? (activeDiaData.variante ?? 'natacion') : activeDiaData.sesion));
  const ejerciciosVigentes = claveVista ? resolverRutina(claveVista, activeFecha, rutina) : null;

  if (editandoRutina) {
    return (
      <EditorRutina
        sesionKey={editandoRutina}
        ejercicios={resolverRutina(editandoRutina, todayISO, rutina)}
        editada={estaEditada(editandoRutina, todayISO, rutina)}
        onGuardar={(ejs, motivo) => guardarRutina(editandoRutina, ejs, motivo)}
        onRestaurar={() => restaurarRutina(editandoRutina)}
        onCerrar={() => setEditandoRutina(null)}
      />
    );
  }

  if (view === 'session' && activeDiaData) {
    return (
      <>
        <SessionView
          diaData={activeDiaData} sesionKey={claveVista}
          ejerciciosVigentes={ejerciciosVigentes}
          huerfanos={huerfanosDelDia(progress[activeFecha] ?? {}, ejerciciosVigentes ?? [])}
          onEditarRutina={setEditandoRutina}
          rutinaEditada={estaEditada(claveVista, todayISO, rutina)}
          esSecundaria={!!activeSesion}
          onSecundaria={onSecundaria} onComplemento={onComplemento} onAbrirSesion={abrirSesionDelDia}
          css={css} onCSS={setCss}
          onFlexible={onFlexible} onConvertirFlexible={onConvertirFlexible}
          progress={progress[activeFecha]} prMap={prMap}
          onBack={backToCalendar} onToggleSet={toggleSet} onLog={onLog} onLastre={onLastre} onBanda={onBanda}
          onReset={resetDay} restTimer={restTimer} onSkipTimer={skipTimer}
          avisosReset={avisosReset} onSueno={onSueno}
        />
      </>
    );
  }

  return (
    <>
      <CalendarView
        calendario={calendario} progress={progress} avisos={avisos}
        onOpenDay={openDay} onEditDay={setEditingDay}
        editMode={editMode} setEditMode={setEditMode} todayISO={todayISO}
        saveStatus={saveStatus} mesInfo={mesInfo} onMes={cambiarMes} hayMesAnterior={hayMesAnterior} rutina={rutina}
        onExportar={onExportar} onImportar={onImportar} mensajeDatos={mensajeDatos}
      />
      {editingDay && (
        <EditModal
          dia={editingDay} onSave={saveEdit} onLiberar={liberarDia} onClose={() => setEditingDay(null)}
          ejerciciosRegistrados={Object.keys(progress[editingDay.fecha] || {}).filter(k => !k.startsWith('__')).length}
        />
      )}
    </>
  );
}
