import React, { useMemo, useCallback } from 'react';
import { Check, Circle, Settings, Star, AlertTriangle } from 'lucide-react';
import { TURNO_INFO, SESION_INFO, SESIONES, DIAS_SEMANA } from '../../data.js';
import { resolverRutina } from '../../rutina.js';
import { COMPLETADO } from '../../utiles/constantes-ui.js';
import { hexARgba } from '../../utiles/formato.js';
import { contarRender } from '../../utiles/medir.js';
import { usePlanCtx, useProgresoCtx, useAccionesCtx } from '../../estado/contextos.js';
import IconFor from '../comunes/IconFor.jsx';
import BarraCalendario from './BarraCalendario.jsx';
import PanelEstadisticas from '../estadisticas/PanelEstadisticas.jsx';

// ═══════════════ CALENDAR VIEW ═══════════════
// Lee el calendario y el progreso de los contextos. Las cuatro props que
// quedan tocan flags de pantalla que viven en App (modo edición, biblioteca).
const CalendarView = ({ onEditDay, editMode, setEditMode, onBiblioteca }) => {
  contarRender('CalendarView');
  const { calendario, todayISO, mesInfo, avisos, rutina } = usePlanCtx();
  const { progress, prMap } = useProgresoCtx();
  const { openDay: onOpenDay } = useAccionesCtx();

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
      <BarraCalendario onBiblioteca={onBiblioteca} editMode={editMode} setEditMode={setEditMode} />

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
            // Día hecho: marco encendido del color de la sesión (ver COMPLETADO)
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

        <PanelEstadisticas stats={stats} calendario={calendario} progress={progress}
          todayISO={todayISO} rutina={rutina} prMap={prMap} />

        {/* Nota inferior */}
        <p className="text-center text-[10px] text-slate-600 mt-4 px-4">
          Toca un día para ver o registrar tu entrenamiento{editMode ? '' : ''}
        </p>
      </main>
    </div>
  );
};

export default CalendarView;
