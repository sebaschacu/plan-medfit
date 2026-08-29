// ═══════════════ VERIFICADOR DE RUTINA (v6) ═══════════════
//
// Evalúa una sesión editada a mano contra las reglas que el plan v6 ya trae
// escritas. NO bloquea: clasifica los hallazgos en DURAS (seguridad y estructura)
// y BLANDAS (dosis y criterio), y la app decide cómo presentarlos.
//
// Principio: el verificador solo aplica reglas que están en el plan. No opina
// sobre si un ejercicio es "bueno". En cuanto empiece a opinar de más, se ignora.
//
// ⚠️ POR QUÉ HACE FALTA UNA TABLA EXPLÍCITA PARA E8
// La regla E8 ("bi-series solo entre ejercicios que no solapen") NO se puede
// deducir solo de la metadata muscular. Contrastado contra la tabla ✅/❌ de la
// sección 4.3 del plan, el mejor criterio automático acierta 6 de 8:
//   · Deja pasar "press inclinado + elevación lateral", que el plan prohíbe:
//     son cabezas distintas del deltoides, así que la intersección sale vacía,
//     pero ambas cargan el hombro bajo la misma fatiga de empuje.
//   · Bloquea "remo + rueda abdominal", que el plan permite: el dorsal figura
//     como secundario en la rueda, donde solo ESTABILIZA.
// De ahí los dos mecanismos de abajo: PARES_INCOMPATIBLES y `estabiliza`.

import { SESIONES, MUSCULOS } from './data.js';

// Músculos que, aun siendo de cabezas distintas, comparten canal de fatiga y por
// tanto no deben emparejarse en una bi-serie.
export const PARES_INCOMPATIBLES = [
  // El deltoides anterior llega ya fatigado de cualquier press; el medio se
  // resiente. Anterior + POSTERIOR sí funciona: son antagonistas (press + face pull).
  ['deltoides_anterior', 'deltoides_medio'],
];

// Secundarios que solo estabilizan y no cuentan como solapamiento.
// Se declaran por ID de ejercicio para no ensuciar la taxonomía.
export const SOLO_ESTABILIZA = {
  'B-4': ['dorsal'],            // rueda abdominal: el dorsal fija, no trabaja
  'CAL-3': ['core_antiextension'], // flexiones: el core aguanta la línea
  'CAL-8': [],
};

const ES_PIERNA = new Set(['cuadriceps', 'isquios', 'gluteo', 'gluteo_medio', 'aductores', 'gemelo', 'soleo']);
const ES_TORSO = new Set(['pecho', 'deltoides_anterior', 'deltoides_medio', 'triceps',
  'dorsal', 'espalda_media', 'trapecio', 'deltoides_posterior', 'biceps', 'braquial']);

// Acarreos limitados por AGARRE → van al final (E5). Por POSTURA → temprano.
const ACARREO_AGARRE = /farmer|suitcase/i;
const ACARREO_POSTURA = /bear hug|zercher/i;

const nombreMusc = (m) => MUSCULOS[m]?.label ?? m;
const series = (ex) => (typeof ex.series === 'number' ? ex.series : 0);

// Músculos que un ejercicio realmente trabaja, separando los que solo estabilizan.
function cargaDe(ex) {
  const estab = new Set(SOLO_ESTABILIZA[ex.id] ?? []);
  return {
    primario: ex.musculos?.primario ?? [],
    secundario: (ex.musculos?.secundario ?? []).filter(m => !estab.has(m)),
  };
}

// ─── E8 · ¿solapan dos ejercicios? ───
export function solapan(a, b) {
  const ca = cargaDe(a), cb = cargaDe(b);
  const compartido = [];

  for (const m of ca.primario) {
    if (cb.primario.includes(m)) compartido.push({ musculo: m, motivo: 'ambos lo trabajan como primario' });
    else if (cb.secundario.includes(m)) compartido.push({ musculo: m, motivo: 'primario en uno, secundario en el otro' });
  }
  for (const m of cb.primario) {
    if (ca.secundario.includes(m) && !compartido.some(x => x.musculo === m)) {
      compartido.push({ musculo: m, motivo: 'primario en uno, secundario en el otro' });
    }
  }
  // Pares que comparten canal de fatiga aunque sean músculos distintos
  for (const [m1, m2] of PARES_INCOMPATIBLES) {
    const cruzado =
      (ca.primario.includes(m1) && cb.primario.includes(m2)) ||
      (ca.primario.includes(m2) && cb.primario.includes(m1));
    if (cruzado && !compartido.some(x => x.musculo === m1 || x.musculo === m2)) {
      compartido.push({ musculo: m1, motivo: `comparte fatiga con ${nombreMusc(m2)}` });
    }
  }
  return compartido;
}

// ─── El verificador ───
// Devuelve { duras: [...], blandas: [...], resumen: {...} }
// Cada hallazgo: { regla, texto, ejercicios: [ids] }
export function verificarSesion(sesionKey, ejercicios) {
  const duras = [];
  const blandas = [];
  const base = SESIONES[sesionKey];
  const dura = (regla, texto, ids = []) => duras.push({ regla, texto, ejercicios: ids });
  const blanda = (regla, texto, ids = []) => blandas.push({ regla, texto, ejercicios: ids });

  const lista = ejercicios ?? [];
  const conSeries = lista.filter(e => series(e) > 0);

  // ── Integridad: sin esto se rompen las estadísticas ──
  const sinMusculos = lista.filter(e => !e.musculos?.primario);
  if (sinMusculos.length) {
    dura('METADATA', `${sinMusculos.length} ejercicio(s) sin músculos asignados: no contarían en las estadísticas de volumen.`,
      sinMusculos.map(e => e.id));
  }
  const idsRepetidos = lista.map(e => e.id).filter((id, i, a) => a.indexOf(id) !== i);
  if (idsRepetidos.length) {
    dura('METADATA', `IDs repetidos (${[...new Set(idsRepetidos)].join(', ')}): el registro de series se mezclaría entre ellos.`,
      [...new Set(idsRepetidos)]);
  }

  // ── E2 · torso y pierna nunca se mezclan ──
  // Solo aplica a sesiones que NACEN separadas. La calistenia del plan es full
  // body a propósito, así que la regla no le corresponde; se deduce de la propia
  // plantilla en vez de mantener una lista de excepciones que se quedaría vieja.
  // La ZONA de una sesión la define su trabajo principal, no un finisher opcional.
  // Si no, la "práctica de carga real" y las escaleras cargando —que llevan pierna
  // como primario y viven al final de Gym A— harían pasar esa sesión por full body
  // y desactivarían E2 justo donde más falta hace.
  const trabajoPrincipal = (ejs) => (ejs ?? []).filter(e => !e.opcional && e.parte !== 'finisher');
  const mezclaEn = (ejs) => {
    const m = new Set(trabajoPrincipal(ejs).flatMap(e => e.musculos?.primario ?? []));
    return [...m].some(x => ES_PIERNA.has(x)) && [...m].some(x => ES_TORSO.has(x));
  };
  const plantillaEsFullBody = mezclaEn(base?.ejercicios);
  const musculosSesion = new Set(trabajoPrincipal(conSeries).flatMap(e => e.musculos?.primario ?? []));
  const hayPierna = [...musculosSesion].some(m => ES_PIERNA.has(m));
  const hayTorso = [...musculosSesion].some(m => ES_TORSO.has(m));
  if (hayPierna && hayTorso && !plantillaEsFullBody) {
    const culpables = conSeries.filter(e => (e.musculos?.primario ?? []).some(m => ES_PIERNA.has(m)))
      .map(e => e.id);
    dura('E2', 'Esta sesión mezcla torso y pierna. El plan las mantiene separadas: cada sesión es de una zona.', culpables);
  }

  // ── E1 · los compuestos de Parte 1 van en series rectas ──
  lista.filter(e => e.parte === 1 && e.bs).forEach(e => {
    dura('E1', `"${e.nombre}" está en Parte 1 dentro de una bi-serie. Los compuestos pesados van en series rectas con descansos largos.`, [e.id]);
  });

  // ── E8 · bi-series solo entre ejercicios que no solapen ──
  const grupos = {};
  lista.forEach(e => { if (e.bs) (grupos[e.bs] ??= []).push(e); });
  Object.entries(grupos).forEach(([bs, miembros]) => {
    if (miembros.length === 1) {
      blanda('E8', `La bi-serie ${bs} tiene un solo ejercicio: se ejecutará como serie recta.`, miembros.map(e => e.id));
      return;
    }
    if (miembros.length > 2) {
      blanda('E8', `La bi-serie ${bs} tiene ${miembros.length} ejercicios. El plan las define de dos en dos.`, miembros.map(e => e.id));
    }
    for (let i = 0; i < miembros.length; i++) {
      for (let j = i + 1; j < miembros.length; j++) {
        const choque = solapan(miembros[i], miembros[j]);
        if (choque.length) {
          const detalle = choque.map(c => `${nombreMusc(c.musculo)} (${c.motivo})`).join(' · ');
          dura('E8', `${bs}: "${miembros[i].nombre}" y "${miembros[j].nombre}" solapan en ${detalle}. Emparejar dos ejercicios que compiten por el mismo músculo hace que el segundo salga peor.`,
            [miembros[i].id, miembros[j].id]);
        }
      }
    }
  });

  // ── E9 · un solo acarreo por sesión ──
  const acarreos = lista.filter(e => e.acarreo);
  if (acarreos.length > 1) {
    dura('E9', `${acarreos.length} acarreos en la misma sesión. El plan permite uno: son muy costosos de recuperar.`,
      acarreos.map(e => e.id));
  }

  // ── E5 · dónde va cada acarreo ──
  acarreos.forEach(e => {
    const idx = lista.indexOf(e);
    const enFinal = e.parte === 'finisher' || idx >= lista.length - 2;
    if (ACARREO_AGARRE.test(e.nombre) && !enFinal) {
      dura('E5', `"${e.nombre}" está limitado por AGARRE y va antes del final. Si te fríes el agarre, el remo y el jalón que vengan después salen peor.`, [e.id]);
    }
    if (ACARREO_POSTURA.test(e.nombre) && e.parte === 'finisher') {
      dura('E5', `"${e.nombre}" está limitado por POSTURA y va al final. Necesita erectores frescos: colócalo temprano.`, [e.id]);
    }
  });

  // ── E6 · el face pull no se recorta ──
  const teniaFacePull = (base?.ejercicios ?? []).some(e => /face pull/i.test(e.nombre));
  const tieneFacePull = lista.some(e => /face pull|pájaro/i.test(e.nombre));
  if (teniaFacePull && !tieneFacePull) {
    dura('E6', 'Quitaste el face pull. Es el contrapeso obligatorio a las series de press y no se recorta nunca.');
  }

  // ── R2 · los compuestos de Parte 1 no se quitan ──
  const p1Base = (base?.ejercicios ?? []).filter(e => e.parte === 1 && e.lineal);
  const idsActuales = new Set(lista.map(e => e.id));
  const quitados = p1Base.filter(e => !idsActuales.has(e.id));
  if (quitados.length) {
    dura('R2', `Quitaste ${quitados.length === 1 ? 'el compuesto' : 'los compuestos'} de Parte 1: ${quitados.map(e => e.nombre).join(', ')}. Es lo último que se recorta — ahí vive tu progresión lineal.`,
      quitados.map(e => e.id));
  }

  // ── Avisos de dosis (blandas) ──
  const totalSeries = conSeries.filter(e => !e.opcional).reduce((a, e) => a + series(e), 0);
  const totalBase = (base?.ejercicios ?? []).filter(e => !e.opcional).reduce((a, e) => a + series(e), 0);
  if (totalBase > 0) {
    const delta = totalSeries - totalBase;
    if (delta >= 4) {
      blanda('VOLUMEN', `${totalSeries} series obligatorias, ${delta} más que el plan (${totalBase}). El propio Anexo B avisa de que el volumen ya está por encima de lo recomendable para tu nivel.`);
    } else if (delta <= -6) {
      blanda('VOLUMEN', `${totalSeries} series obligatorias, ${Math.abs(delta)} menos que el plan (${totalBase}). Recorte razonable si la recuperación no daba, pero anótalo.`);
    }
  }

  // Progresión lineal declarada en los compuestos de Parte 1
  lista.filter(e => e.parte === 1 && series(e) >= 3 && !e.lineal && e.rir).forEach(e => {
    blanda('P1', `"${e.nombre}" está en Parte 1 pero sin progresión lineal. En tu nivel la lineal supera al RIR en los compuestos.`, [e.id]);
  });

  // Ejercicios nuevos sin metadata de progresión
  lista.filter(e => !e.lineal && !e.rir && series(e) > 0).forEach(e => {
    blanda('P1', `"${e.nombre}" no indica ni progresión lineal ni RIR: no sabrás cómo subirle.`, [e.id]);
  });

  return {
    duras,
    blandas,
    resumen: {
      ejercicios: lista.length,
      series: totalSeries,
      seriesPlan: totalBase,
      biseries: Object.keys(grupos).length,
      acarreos: acarreos.length,
      limpio: duras.length === 0,
    },
  };
}

// Volumen por grupo muscular de UNA sesión (series efectivas: primario ×1, secundario ×0.5).
// Sirve para enseñar en el editor cómo cambia el reparto al tocar la rutina.
export function volumenSesion(ejercicios) {
  const vol = {};
  (ejercicios ?? []).forEach(e => {
    const s = series(e);
    if (!s || e.opcional) return;
    (e.musculos?.primario ?? []).forEach(m => { vol[m] = (vol[m] || 0) + s; });
    (e.musculos?.secundario ?? []).forEach(m => { vol[m] = (vol[m] || 0) + s * 0.5; });
  });
  return vol;
}
