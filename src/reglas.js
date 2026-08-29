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
export const S4 = (h) => {
  if (h == null || h === '') return null;
  const n = Number(h);
  if (Number.isNaN(n)) return null;
  if (n < 5) return { nivel: 'descanso', color: '#f87171', borde: 'border-red-500', fondo: 'bg-red-950/25', texto: 'Menos de 5h: hoy es DESCANSO COMPLETO. No es negociable — entrenar con este déficit no te da adaptación, te da fatiga.' };
  if (n <= 6) return { nivel: 'reducida', color: '#fbbf24', borde: 'border-amber-500', fondo: 'bg-amber-950/25', texto: 'Entre 5 y 6h: sesión REDUCIDA. Dos series por ejercicio y fuera los acarreos. Los compuestos de Parte 1 se mantienen.' };
  return { nivel: 'normal', color: '#4ade80', borde: 'border-emerald-500', fondo: 'bg-emerald-950/25', texto: 'Más de 6h: sesión NORMAL. Adelante con todo.' };
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
