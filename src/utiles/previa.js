import { generarDesdeAncla, aISO, deISO } from '../generador.js';
import { nombrarClaves } from './nombres.js';
import { normalizarConfig, claveDeporte } from '../config.js';

// ═══════════════ CÓMO QUEDARÍA ═══════════════
// Antes de guardar un ajuste, se genera el calendario con él y se resumen las
// próximas cuatro semanas completas: cuántas sesiones de cada cosa salen de
// media y qué no cabe. Es la misma función que pinta el calendario, así que lo
// que se ve aquí es lo que se verá allí.
const SEMANAS = 4;

export function previsualizar({ ancla, fijados, festivos, config, desde }) {
  const d0 = deISO(desde);
  // Primer lunes a partir de mañana: semanas enteras, comparables entre sí
  const lunes = new Date(d0.getTime() + ((8 - d0.getUTCDay()) % 7 || 7) * 864e5);
  const fin = new Date(lunes.getTime() + (SEMANAS * 7 - 1) * 864e5);
  const { dias, avisos } = generarDesdeAncla({ hasta: aISO(fin), ancla, fijados, festivos, config });
  const rango = dias.filter(d => d.fecha >= aISO(lunes));
  const cuenta = { gym: 0, natacion: 0, cardio: 0, descanso: 0, dobles: 0 };
  const deportes = {};
  // Los nombres salen de la config que se está editando: un deporte nuevo
  // todavía no está registrado como sesión.
  const nombreDeporte = Object.fromEntries((normalizarConfig(config).deportes ?? []).map(d => [claveDeporte(d.id), d.nombre]));
  for (const d of rango) {
    if (d.sesionSecundaria) cuenta.dobles++;
    for (const k of [d.sesion, d.sesionSecundaria].filter(Boolean)) {
      if (k.startsWith('gym')) cuenta.gym++;
      else if (k === 'natacion') cuenta.natacion++;
      else if (k === 'running' || k === 'ciclismo') cuenta.cardio++;
      else if (k === 'descanso') cuenta.descanso++;
      else if (k.startsWith('dep_')) deportes[k] = (deportes[k] ?? 0) + 1;
    }
  }
  const media = (n) => Math.round((n / SEMANAS) * 10) / 10;
  // Lo que no cupo, sin repetir el mismo problema cuatro veces
  const problemas = avisos
    .filter(a => (a.fecha ?? a.semana) >= aISO(lunes) && ['sin_hueco_doblando', 'limite_dobles', 'deporte_sin_hueco', 'doble_en_descarga'].includes(a.tipo))
    .map(a => nombrarClaves(a.texto.replace(/^(Semana del \d+|Día \d+): /, '')))
    .map(t => t.charAt(0).toUpperCase() + t.slice(1));
  return {
    semanas: SEMANAS,
    gym: media(cuenta.gym), natacion: media(cuenta.natacion), cardio: media(cuenta.cardio),
    descanso: media(cuenta.descanso), dobles: media(cuenta.dobles),
    deportes: Object.entries(deportes).map(([k, n]) => [nombreDeporte[k] ?? k, media(n)]),
    problemas: [...new Set(problemas)].slice(0, 3),
    nProblemas: problemas.length,
    turnos: rango.slice(0, 8).map(d => d.turno),
  };
}
