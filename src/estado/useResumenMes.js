import { useMemo, useCallback } from 'react';
import { SESIONES } from '../data.js';
import { resolverRutina } from '../rutina.js';
import { usePlanCtx, useProgresoCtx } from './contextos.js';

// ═══════════════ RESUMEN DEL MES ═══════════════
// Cuánto de cada día está hecho y las cifras del mes (completadas, racha,
// desglose). Lo usan el calendario —para pintar las celdas— y Progreso.
export function useResumenMes() {
  const { calendario, todayISO, rutina } = usePlanCtx();
  const { progress } = useProgresoCtx();

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
    if (done === total) return 'full';
    if (done > 0) return 'partial';
    // A medias también es haber empezado: una serie marcada ya cuenta.
    const empezado = ejercicios.some(ex => p[ex.id]?.sets?.some(Boolean));
    return empezado ? 'partial' : 'none';
  }, [progress, rutina]);

  const stats = useMemo(() => {
    // Días entrenables = los que tienen sesión con ejercicios (no descanso)
    const entrenables = calendario.filter(d => {
      const s = SESIONES[d.sesion];
      return s && s.ejercicios.length > 0;
    });
    const totalEntrenables = entrenables.length;

    let completadas = 0, parciales = 0;
    const cats = { gym: 0, cardio: 0, calistenia: 0 };
    const catsTotal = { gym: 0, cardio: 0, calistenia: 0 };
    const catOf = (sesion) => {
      if (sesion.startsWith('gym')) return 'gym';
      if (sesion === 'natacion' || sesion === 'running' || sesion === 'ciclismo') return 'cardio';
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

    // Racha: días completados consecutivos hacia atrás desde hoy.
    // Contamos sobre días entrenables; los de descanso no rompen ni suman.
    let racha = 0;
    const ordenados = [...calendario].filter(d => d.fecha <= todayISO).sort((a, b) => b.fecha.localeCompare(a.fecha));
    for (const d of ordenados) {
      const ses = SESIONES[d.sesion];
      if (!ses || ses.ejercicios.length === 0) continue;
      if (dayCompletion(d) === 'full') racha++;
      else break;
    }

    const pct = totalEntrenables > 0 ? Math.round((completadas / totalEntrenables) * 100) : 0;
    return { totalEntrenables, completadas, parciales, pct, racha, cats, catsTotal };
  // `progress` no va en las dependencias: ya entra a través de dayCompletion.
  }, [calendario, dayCompletion, todayISO]);

  return { dayCompletion, stats };
}
