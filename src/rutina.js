// ═══════════════ RUTINA VERSIONADA ═══════════════
//
// Las SESIONES de data.js son la BASE INMUTABLE: el plan tal y como se diseñó.
// Lo que el usuario edita son VERSIONES con fecha encima de esa base.
//
// PRINCIPIO: el pasado no se reescribe. Resolver la rutina de un día es "la
// última versión cuyo `desde` sea anterior o igual a esa fecha". Así una sesión
// que entrenaste en septiembre sigue mostrando los ejercicios que hiciste, y no
// los que decidiste en noviembre. Es la misma idea que el auto-fijado de días.
//
// Forma del estado:
//   rutina = {
//     gymA: [
//       { desde: '2026-09-15', ejercicios: [...], motivo: 'cambié el press por...' },
//       { desde: '2026-11-02', ejercicios: [...], motivo: '...' },
//     ]
//   }

import { SESIONES } from './data.js';
import { aplicarCambios } from './alternativas.js';

// Ejercicios vigentes de una sesión en una fecha dada.
export function resolverRutina(sesionKey, fecha, rutina = {}) {
  const base = SESIONES[sesionKey]?.ejercicios ?? [];
  const versiones = rutina[sesionKey];
  if (!Array.isArray(versiones) || !versiones.length) return base;
  const vigente = versiones
    .filter(v => !fecha || v.desde <= fecha)
    .sort((a, b) => a.desde.localeCompare(b.desde))
    .at(-1);
  return vigente?.ejercicios ?? base;
}

// Lo que se hace ESE día: la rutina vigente con los cambios de solo hoy
// (ejercicio por una alternativa, guardado en el registro del día).
export const ejerciciosDelDia = (sesionKey, fecha, rutina, progresoDia) =>
  aplicarCambios(resolverRutina(sesionKey, fecha, rutina), progresoDia);

// ¿Esta sesión está editada respecto al plan, en esta fecha?
export function estaEditada(sesionKey, fecha, rutina = {}) {
  const base = SESIONES[sesionKey]?.ejercicios ?? [];
  const actual = resolverRutina(sesionKey, fecha, rutina);
  return JSON.stringify(actual.map(e => e.id)) !== JSON.stringify(base.map(e => e.id))
    || JSON.stringify(actual) !== JSON.stringify(base);
}

// Guarda una versión nueva con fecha de hoy. Si ya hay una versión de hoy,
// la sustituye: editar dos veces el mismo día no crea dos versiones.
// El motivo es OPCIONAL al guardar. Si viene vacío se anota "Sin motivo": así
// el historial no tiene huecos y se sigue sabiendo cuándo cambió cada cosa,
// aunque no por qué.
export const SIN_MOTIVO = 'Sin motivo';
export function guardarVersion(rutina, sesionKey, ejercicios, desde, motivo) {
  const previas = (rutina[sesionKey] ?? []).filter(v => v.desde !== desde);
  return {
    ...rutina,
    [sesionKey]: [...previas, { desde, ejercicios, motivo: String(motivo ?? '').trim() || SIN_MOTIVO }]
      .sort((a, b) => a.desde.localeCompare(b.desde)),
  };
}

// Vuelve al plan original a partir de una fecha (no borra el historial anterior).
export function restaurarPlan(rutina, sesionKey, desde) {
  const base = SESIONES[sesionKey]?.ejercicios ?? [];
  return guardarVersion(rutina, sesionKey, JSON.parse(JSON.stringify(base)), desde, 'Vuelta al plan original');
}

// Ejercicios registrados en un día que YA NO están en la rutina vigente.
// No se borran nunca: se enseñan aparte para que nada desaparezca en silencio.
export function huerfanosDelDia(progresoDia = {}, ejerciciosVigentes = []) {
  const vigentes = new Set(ejerciciosVigentes.map(e => e.id));
  return Object.keys(progresoDia)
    .filter(k => !k.startsWith('__') && !vigentes.has(k));
}

// Catálogo de todos los ejercicios conocidos del plan, para añadir en el editor.
// Se agrupa por sesión de origen para que se entienda de dónde sale cada uno.
export function catalogoEjercicios(rutina = {}) {
  const out = [];
  for (const [k, ses] of Object.entries(SESIONES)) {
    for (const ex of ses.ejercicios ?? []) {
      out.push({ ...ex, origen: k, origenNombre: ses.nombre });
    }
  }
  // Los ejercicios creados por el usuario viven dentro de la rutina donde se
  // crearon. Se suman al catálogo —desde la última versión de cada rutina— para
  // poder añadirlos también a las demás. Uno por nombre.
  const nombres = new Set(out.map(e => e.nombre.toLowerCase()));
  for (const [k, versiones] of Object.entries(rutina ?? {})) {
    const ultima = Array.isArray(versiones) ? versiones.at(-1) : null;
    for (const ex of ultima?.ejercicios ?? []) {
      const n = String(ex?.nombre ?? '').toLowerCase();
      if (!n || nombres.has(n)) continue;
      nombres.add(n);
      out.push({ ...ex, origen: k, origenNombre: SESIONES[k]?.nombre ?? k, propio: true });
    }
  }
  return out;
}

// Un ID nuevo que no choque con los existentes de la sesión.
export function nuevoId(sesionKey, ejercicios) {
  const prefijo = (sesionKey.replace('gym', '').replace('nat', 'N') || 'X').toUpperCase();
  let n = 1;
  const usados = new Set(ejercicios.map(e => e.id));
  while (usados.has(`${prefijo}-x${n}`)) n++;
  return `${prefijo}-x${n}`;
}

// Reordenar dentro de la lista
export function mover(ejercicios, index, delta) {
  const destino = index + delta;
  if (destino < 0 || destino >= ejercicios.length) return ejercicios;
  const copia = [...ejercicios];
  [copia[index], copia[destino]] = [copia[destino], copia[index]];
  return copia;
}

// Grupos de bi-serie disponibles: los existentes más uno nuevo, y "sin bi-serie".
export function gruposBS(ejercicios) {
  const usados = [...new Set(ejercicios.map(e => e.bs).filter(Boolean))].sort();
  const siguiente = `BS${usados.length + 1}`;
  return [null, ...usados, ...(usados.includes(siguiente) ? [] : [siguiente])];
}
