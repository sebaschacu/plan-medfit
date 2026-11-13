// ═══════════════ QUÉ PROPONE «HECHA» ═══════════════
// La tarjeta propone una carga y unas repeticiones para la serie que toca, de
// modo que registrarla sea un toque. Orden de preferencia:
//   kg    lo ya anotado en esa serie → la serie anterior de hoy → la carga
//         sugerida por la progresión → lo último que se levantó
//   reps  lo ya anotado → la serie anterior de hoy → la misma serie de la
//         última sesión → el mínimo del rango
// Es una propuesta: «Ajustar» la cambia antes y «Corregir» después.

// ¿Este ejercicio se anota en kg × reps? Igual criterio que siempre: los de
// progresión lineal y los que llevan RIR. Bloques de natación o carrera, no.
export const anotaCarga = (ex) => !!(ex.lineal || (ex.rir && ex.rir !== '—'));

export const repsMinimas = (reps) => {
  const m = /^(\d+)/.exec(String(reps ?? '').trim());
  return m ? Number(m[1]) : null;
};

export function proponerSerie(ex, prog, i, sugerencia, ultima) {
  const logs = prog?.logs ?? [];
  const actual = logs[i] ?? null;
  let previa = null;
  for (let j = i - 1; j >= 0 && !previa; j--) if (logs[j] && (logs[j].kg != null || logs[j].reps != null)) previa = logs[j];
  const kg = actual?.kg ?? previa?.kg ?? sugerencia?.kg ?? (ultima?.kgMax || null);
  const reps = actual?.reps ?? previa?.reps ?? ultima?.logs?.[i]?.reps ?? ultima?.logs?.[0]?.reps ?? repsMinimas(ex.reps);
  return { kg: kg ?? null, reps: reps ?? null };
}

// «145 × 13», «8 reps» o nada: lo que se lee en el botón y en la casilla.
export const textoSerie = (log) => {
  if (!log) return '';
  if (log.kg != null && log.reps != null) return `${log.kg} × ${log.reps}`;
  if (log.kg != null) return `${log.kg} kg`;
  if (log.reps != null) return `${log.reps} reps`;
  return '';
};

// Primera serie sin marcar; -1 si están todas.
export const serieQueToca = (prog, setCount) => {
  for (let i = 0; i < setCount; i++) if (!prog?.sets?.[i]) return i;
  return -1;
};
