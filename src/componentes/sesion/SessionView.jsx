import React, { useMemo } from 'react';
import { Moon, Trophy, RotateCcw, ChevronRight, Settings, ArrowLeft, Star, AlertTriangle, Clock } from 'lucide-react';
import { SESION_INFO, SESIONES, PARTES, PISCINA_DURACION_MIN } from '../../data.js';
import { S4, ultimaSesion, sugerirCarga } from '../../reglas.js';
import { VACIO } from '../../utiles/constantes-ui.js';
import { mesDeISO } from '../../utiles/formato.js';
import { contarRender } from '../../utiles/medir.js';
import IconFor from '../comunes/IconFor.jsx';
import NumInput from '../comunes/NumInput.jsx';
import RestTimer from '../comunes/RestTimer.jsx';
import ExerciseCard from './ExerciseCard.jsx';
import SelectorVariante from './SelectorVariante.jsx';
import PanelFlexible from './PanelFlexible.jsx';
import PanelCSS from './PanelCSS.jsx';
import PanelDia from './PanelDia.jsx';

// ═══════════════ SESSION VIEW ═══════════════
const SessionView = ({ diaData, sesionKey, ejerciciosVigentes, huerfanos = [], onEditarRutina, rutinaEditada, progress, prMap, onBack, onToggleSet, onLog, onLastre, onBanda, onReset, restTimer, onSkipTimer, avisosReset = {}, onSueno, onSecundaria, onComplemento, onAbrirSesion, esSecundaria, css, onCSS, onFlexible, onConvertirFlexible,
  onFijarVariante, onSoltarVariante, onVerFicha, progresoTotal = {}, onUsarSugerido }) => {
  contarRender('SessionView');
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
              {/* El nombre abre la ficha de la sesión: es la consulta más frecuente */}
              <button onClick={() => onVerFicha?.(sesionKey)} className="text-left">
                <h1 className="text-xl font-bold text-slate-50 leading-none flex items-center gap-1.5">
                  {ses.nombre}
                  <ChevronRight size={15} className="text-slate-500 flex-shrink-0" />
                </h1>
              </button>
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

        {/* Cuál de la cola toca hoy, y cambiarla sin romper la rotación */}
        {!esSecundaria && onFijarVariante && (
          <>
            <SelectorVariante dia={diaData} onFijar={onFijarVariante} onSoltar={onSoltarVariante}
              registrados={Object.keys(dayProg).filter(k => !k.startsWith('__')).length} />
            {diaData.sesionSecundaria && (
              <SelectorVariante dia={diaData} secundaria onFijar={onFijarVariante} onSoltar={onSoltarVariante}
                registrados={Object.keys(dayProg).filter(k => !k.startsWith('__')).length} />
            )}
          </>
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
                    avisoReset={avisosReset[ex.id]}
                    onUsarSugerido={onUsarSugerido}
                    ultima={ultimaSesion(progresoTotal, ex.id, diaData.fecha)}
                    sugerencia={sugerirCarga(ex, progresoTotal, { hasta: diaData.fecha, descarga: !!diaData.descarga })} />
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

export default SessionView;
