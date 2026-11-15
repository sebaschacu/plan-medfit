// ═══════════════ REGLAS DEL PLAN v6 QUE DEPENDEN DEL HISTORIAL ═══════════════
// Separadas de App.jsx para poder probarlas sin montar la UI.

// ─── Regla P6 · aviso de reset ───
// "Si fallas las reps objetivo dos sesiones seguidas en un ejercicio: bajas el 10%
//  de la carga y vuelves a subir desde ahí."
// Una sesión CUENTA como fallo si la mejor serie registrada quedó por debajo del
// extremo bajo del rango de reps. Solo se miran sesiones con reps registradas:
// un día sin datos no es un fallo, es un día sin datos.
const repsMinimas = (reps) => {
  const m = String(reps ?? '').match(/(\d+)/);
  return m ? Number(m[1]) : null;
};

export function calcularAvisosReset(progress, sesiones) {
  const porEjercicio = {};   // exId -> [{fecha, mejorReps, mejorKg}]
  for (const [fecha, dia] of Object.entries(progress || {})) {
    for (const [exId, p] of Object.entries(dia || {})) {
      const logs = (p?.logs || []).filter(l => l && l.reps != null);
      if (!logs.length) continue;
      (porEjercicio[exId] ??= []).push({
        fecha,
        mejorReps: Math.max(...logs.map(l => l.reps)),
        mejorKg: Math.max(...logs.map(l => l.kg ?? 0)),
      });
    }
  }

  // Índice de ejercicio -> definición, para leer el rango de reps
  const def = {};
  for (const ses of Object.values(sesiones)) for (const ex of ses.ejercicios) def[ex.id] = ex;

  const avisos = {};
  for (const [exId, hist] of Object.entries(porEjercicio)) {
    const ex = def[exId];
    const min = repsMinimas(ex?.reps);
    if (!ex || min == null) continue;
    const ordenado = hist.sort((a, b) => a.fecha.localeCompare(b.fecha));
    if (ordenado.length < 2) continue;
    const [penultima, ultima] = ordenado.slice(-2);
    if (penultima.mejorReps < min && ultima.mejorReps < min) {
      const carga = ultima.mejorKg || penultima.mejorKg;
      avisos[exId] = {
        objetivo: min,
        conseguido: [penultima.mejorReps, ultima.mejorReps],
        fechas: [penultima.fecha, ultima.fecha],
        sugerido: carga ? Math.round(carga * 0.9 * 2) / 2 : null,  // redondeo a 0.5 kg
        actual: carga || null,
      };
    }
  }
  return avisos;
}

// ─── Regla S4 · el posturno depende de las horas de sueño ───
// DOS TRAMOS (decisión del usuario, nov 2026). Antes eran tres y por debajo de
// 5 h mandaba descanso completo; ese descanso obligatorio ya no existe.
//   menos de 6 h → sesión reducida, sin segunda sesión
//   6 h o más    → sesión normal
// En la interfaz son dos botones, que guardan en `__sueno` un valor
// representativo de cada tramo (SUENO_POCO / SUENO_BIEN). La clave y el tipo
// (número de horas) no cambian: los respaldos antiguos siguen valiendo.
export const SUENO_POCO = 5;
export const SUENO_BIEN = 7;
export const S4 = (h) => {
  if (h == null || h === '') return null;
  const n = Number(h);
  if (Number.isNaN(n)) return null;
  if (n < 6) return { nivel: 'reducida', color: '#f5b54a', texto: 'Menos de 6 h: sesión reducida. Dos series por ejercicio y fuera los acarreos; los compuestos de Parte 1 se mantienen. Hoy no hay segunda sesión.' };
  return { nivel: 'normal', color: '#4ade80', texto: '6 h o más: sesión normal.' };
};

// ═══════════════ NATACIÓN · CSS ═══════════════
// CSS (Critical Swim Speed) = el ritmo umbral. Sin este número todos los ritmos
// del plan son adivinanzas, por eso el test es la primera sesión de todas.
//   CSS en segundos por 100 m = (400 − 200) ÷ (tiempo400 − tiempo200)
// Ojo: esa fórmula da metros/segundo; el ritmo por 100 m es su inverso × 100.

export const mmss = (segundos) => {
  if (segundos == null || !Number.isFinite(segundos)) return '—';
  const s = Math.round(segundos);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// Acepta "6:40", "400", "6.40" → segundos
export const aSegundos = (txt) => {
  if (txt == null || txt === '') return null;
  const t = String(txt).trim().replace(',', ':').replace('.', ':');
  if (t.includes(':')) {
    const [m, s] = t.split(':');
    const min = Number(m), seg = Number(s);
    if (!Number.isFinite(min) || !Number.isFinite(seg)) return null;
    return min * 60 + seg;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

// Devuelve el CSS en segundos por 100 m a partir de los dos tiempos del test.
export function calcularCSS(t400, t200) {
  const a = aSegundos(t400), b = aSegundos(t200);
  if (a == null || b == null) return null;
  if (a <= b) return { error: 'El tiempo de los 400 m tiene que ser mayor que el de los 200 m.' };
  const velocidad = (400 - 200) / (a - b);          // m/s
  if (!Number.isFinite(velocidad) || velocidad <= 0) return { error: 'Esos tiempos no dan un CSS válido.' };
  const segPor100 = 100 / velocidad;
  if (segPor100 < 45 || segPor100 > 240) {
    return { segPor100, velocidad, aviso: 'Ese CSS queda fuera de lo plausible: revisa los tiempos.' };
  }
  return { segPor100, velocidad };
}

// Tabla de ritmos relativos al CSS, en segundos por distancia.
// Es mucho más usable en el borde de la piscina que ir calculando.
export const RITMOS_CSS = [
  { clave: 'CSS−5',  delta: -5, uso: 'Series cortas, velocidad' },
  { clave: 'CSS',    delta: 0,  uso: 'Series principales de umbral' },
  { clave: 'CSS+5',  delta: 5,  uso: 'Aeróbico sostenido' },
  { clave: 'CSS+10', delta: 10, uso: 'Recuperación activa, series largas' },
];

export function tablaRitmos(segPor100) {
  if (segPor100 == null || !Number.isFinite(segPor100)) return [];
  return RITMOS_CSS.map(r => {
    const por100 = segPor100 + r.delta;
    return {
      ...r,
      por50: mmss(por100 / 2),
      por100: mmss(por100),
      por200: mmss(por100 * 2),
      por400: mmss(por100 * 4),
    };
  });
}

// ═══════════════ RUNNING · RITMO UMBRAL ═══════════════
// Test de 30 min: el ritmo medio de 30 min a tope sostenible se aproxima a tu
// ritmo umbral. Ritmo (seg/km) = 1.800 s ÷ km recorridos.
// Acepta "6.2", "6,2" o metros ("6200").
export const aKm = (txt) => {
  if (txt == null || txt === '') return null;
  const n = Number(String(txt).trim().replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n > 100 ? n / 1000 : n;     // más de 100 = lo escribió en metros
};

export function calcularUmbralRun(distancia) {
  const km = aKm(distancia);
  if (km == null) return null;
  const segPorKm = 1800 / km;
  if (segPorKm < 150 || segPorKm > 540) {
    return { segPorKm, km, aviso: 'Ese ritmo queda fuera de lo plausible (entre 2:30 y 9:00 por km): revisa la distancia.' };
  }
  return { segPorKm, km };
}

// Tabla de zonas a partir del ritmo umbral. Cada fila da un rango por km,
// del extremo rápido al lento.
export function tablaZonasRun(segPorKm, zonas) {
  if (segPorKm == null || !Number.isFinite(segPorKm)) return [];
  return zonas.map(z => ({
    ...z,
    rapido: mmss(segPorKm * z.desde),
    lento: mmss(segPorKm * z.hasta),
  }));
}

// ═══════════════ HISTORIAL Y SUGERENCIA DE CARGA ═══════════════
// El progreso se indexa por FECHA y dentro por ID de ejercicio. Buscar por ID en
// todo el histórico hace que el historial siga al ejercicio aunque cambie de
// sesión (rutinas versionadas) — el requisito 3 del punto 6.

// Sesiones registradas de un ejercicio, de más antigua a más reciente.
export function historialEjercicio(progress = {}, exId, hasta = null) {
  return Object.entries(progress)
    .filter(([fecha]) => !hasta || fecha < hasta)
    .map(([fecha, dia]) => {
      const p = dia?.[exId];
      // Una serie cuenta como HECHA si tiene reps anotadas o está marcada. Solo
      // kg, sin marcar, es un plan: el botón "usar sugerido" escribe la carga en
      // las series antes de hacerlas, y si ese día no se entrena no puede quedar
      // como sesión fantasma en el historial ("42.5 kg × –, –, –, –").
      const logs = (p?.logs ?? []).filter((l, i) => l && (l.reps != null || p?.sets?.[i]));
      if (!logs.length && p?.lastre == null) return null;
      return {
        fecha,
        logs,
        lastre: p?.lastre ?? null,
        kgMax: logs.length ? Math.max(...logs.map(l => l.kg ?? 0)) : (p?.lastre ?? 0),
        repsMax: logs.length ? Math.max(...logs.map(l => l.reps ?? 0)) : 0,
        // Volumen = suma de kg × reps de cada serie
        volumen: logs.reduce((a, l) => a + (l.kg ?? 0) * (l.reps ?? 0), 0),
        series: logs.length,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// La última sesión registrada, o null si es la primera vez.
export function ultimaSesion(progress, exId, hasta = null) {
  const h = historialEjercicio(progress, exId, hasta);
  return h.length ? h.at(-1) : null;
}

const repsObjetivo = (reps) => {
  const m = String(reps ?? '').match(/(\d+)\s*-\s*(\d+)/);
  if (m) return { min: Number(m[1]), max: Number(m[2]) };
  const s = String(reps ?? '').match(/(\d+)/);
  return s ? { min: Number(s[1]), max: Number(s[1]) } : null;
};

// Incremento lineal según el tren. Sale del campo `progresion` del ejercicio
// ('+2.5 kg', '+5 kg') y cae a 2.5 si no lo declara.
const incrementoDe = (ex) => {
  const m = String(ex.progresion ?? '').match(/([\d.]+)/);
  return m ? Number(m[1]) : 2.5;
};

// ─── Sugerencia de carga para la próxima sesión ───
// Devuelve { kg, motivo, tipo } · tipo: 'subir' | 'mantener' | 'reset' | 'primera' | 'no-aplica'
// SIEMPRE editable: es una sugerencia, no una imposición.
export function sugerirCarga(ex, progress, { hasta = null, descarga = false } = {}) {
  if (!ex) return null;

  // Los isométricos progresan en TIEMPO hasta 60s (P3), no en carga
  if (ex.iso && !ex.lineal) {
    return { kg: null, tipo: 'no-aplica', motivo: 'Aquí progresas en tiempo, no en carga: solo subes peso al pasar de 60s (P3).' };
  }

  const hist = historialEjercicio(progress, ex.id, hasta);
  if (!hist.length) {
    return { kg: null, tipo: 'primera', motivo: 'Primera vez con este ejercicio: empieza conservador y anota la carga.' };
  }
  const ult = hist.at(-1);
  const kg = ult.kgMax || null;

  // En descarga NO se sube: misma carga, la mitad de las series (P4)
  if (descarga) {
    return { kg, tipo: 'mantener',
      motivo: `Semana de descarga (P4): misma carga que el ${ult.fecha.slice(8)}, la mitad de las series y RIR +2. No es semana de subir.` };
  }

  const obj = repsObjetivo(ex.reps);

  // Acarreos: progresan en carga mientras aguantes la distancia con postura (P2)
  if (ex.acarreo) {
    return { kg, tipo: 'mantener',
      motivo: `Última vez ${kg ?? '—'} kg. Sube carga solo si mantuviste los 30 m con postura perfecta; si te inclinaste, baja (P2).` };
  }

  // Aislamientos: doble progresión con RIR, no lineal
  if (!ex.lineal) {
    const tope = obj && ult.repsMax >= obj.max;
    return {
      kg, tipo: tope ? 'subir' : 'mantener',
      motivo: tope
        ? `Llegaste a ${ult.repsMax} reps, el tope del rango. Sube al salto mínimo disponible y vuelve al extremo bajo.`
        : `Doble progresión: quédate en ${kg ?? '—'} kg y sube reps hasta ${obj?.max ?? 'el tope'} antes de tocar el peso.`,
    };
  }

  // ─── Compuestos con progresión lineal ───
  // P6: dos sesiones seguidas fallando el objetivo → reset del 10%
  const dosUltimas = hist.slice(-2);
  const falloDoble = dosUltimas.length === 2 && obj &&
    dosUltimas.every(s => s.repsMax > 0 && s.repsMax < obj.min);
  if (falloDoble) {
    const nuevo = kg ? Math.round(kg * 0.9 * 2) / 2 : null;
    return { kg: nuevo, tipo: 'reset',
      motivo: `Fallaste el objetivo de ${obj.min} reps dos sesiones seguidas (${dosUltimas.map(s => s.repsMax).join(' y ')}). Reset del 10%: de ${kg} a ${nuevo} kg, y vuelves a subir desde ahí (P6).` };
  }

  // Completó el rango en todas las series → sube
  const completo = obj && ult.series > 0 && ult.logs.every(l => (l.reps ?? 0) >= obj.min);
  const inc = incrementoDe(ex);
  if (completo) {
    return { kg: kg ? kg + inc : null, tipo: 'subir',
      motivo: `Completaste las ${ult.series} series en rango el ${ult.fecha.slice(8)}. Sube ${inc} kg.` };
  }
  return { kg, tipo: 'mantener',
    motivo: `No completaste el rango la última vez (${ult.repsMax} reps máx). Repite ${kg ?? '—'} kg hasta cerrarlo.` };
}
