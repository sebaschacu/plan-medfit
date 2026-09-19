// ═══════════════ PLAN v6 · DATOS ═══════════════
// Arquitectura v6: CUPO SEMANAL + PRIORIDAD POR TURNO.
// Las colas circulares por turno de la v5 ya NO existen.
// La única cola es la secuencia de gym: A → C1 → D → C2 → B (contador persistente,
// nunca se reinicia). Ver SECUENCIA_GYM más abajo.
// Turnos: L=libre, C=turno día, N=noche, P=posturno

export const TURNO_INFO = {
  L: { label: 'Libre',    color: '#22c55e', bg: '#0d2818', desc: 'Día libre · cualquier hora' },
  C: { label: 'Turno día', color: '#f59e0b', bg: '#2a1f0a', desc: '12h · entrena tarde' },
  N: { label: 'Noche',    color: '#3b82f6', bg: '#0a1a2e', desc: 'Guardia · entrena 7-13h' },
  P: { label: 'Posturno', color: '#64748b', bg: '#1a1f26', desc: 'Tras dormir ≥5h · tarde' },
};

// ─── v6.1 · Cupo semanal ───
// 3 gym + 2 natación + 1 running = 6 sesiones que necesitan día NO-C,
// + 1 día flexible anclado a turno C. La calistenia SALE del cupo: pasa a ser
// complemento apilable (ver COMPLEMENTOS).
//
// ⚠️ EL DÉFICIT DE DÍAS, MEDIDO
// En 28 días hay 7 de cada turno. Los C no admiten gym (12h de pie) ni natación
// (la piscina cierra antes de salir), así que quedan 21 días útiles para 24
// sesiones: faltan 3 cada 28 días. Se resuelve DOBLANDO sesión en días aptos,
// no recortando (ver DOBLES).
export const CUPO_SEMANAL = {
  gym: 3, natacion: 2, running: 1, flexible: 1,
};

// ─── v6.1 · Sesiones dobles ───
export const GYM_PIERNA = ['gymC1', 'gymC2'];
export const GYM_TORSO = ['gymA', 'gymB', 'gymD'];

// ─── v7.1 · Pares de gym que SOLAPAN si van seguidos ───
// Dos sesiones consecutivas con el mismo patrón principal castigan dos veces la
// misma zona sin recuperar: banca (A y D), dominada (B y D), pierna (C1 y C2).
// La misma sesión repetida solapa siempre. A y B NO solapan: son antagonistas,
// empuje contra tracción. La rotación A→C1→D→C2→B no tiene ningún par
// consecutivo que solape; solo un gym fijado a mano puede provocarlo, y para
// eso está el guardarraíl del generador.
export const GYM_SOLAPAN = [
  ['gymA', 'gymD'],     // banca
  ['gymB', 'gymD'],     // dominada
  ['gymC1', 'gymC2'],   // pierna
];

export const DOBLES = {
  turnos: {
    L: { permite: true,  condicional: false },
    P: { permite: true,  condicional: true,  condicion: 'solo si dormiste ≥6h y la segunda es suave' },
    N: { permite: false, motivo: 'entras a guardia a las 18h: solo cabe una sesión por la mañana' },
    C: { permite: false, motivo: 'ya son 12h de pie' },
  },
  maxPorSemana: 2,            // D1
  noConsecutivos: true,       // D2
  saltarEnDescarga: true,     // D3 · semana 8 del bloque
  semanasBloque: 8,
  separacionMinima: 3,
  separacionIdeal: 4,
  separacionOrdenLibre: 6,
  prioridad: ['running', 'natacion'],
};

// Primero fuerza, después cardio. Si el gimnasio va detrás del cardio se llega con
// el sistema nervioso y las piernas fatigadas y se levanta menos: la progresión
// lineal depende de subir carga cada sesión.
export const ORDEN_DOBLE = { fuerza: 1, cardio: 2 };

// ─── v6.1 · Complementos apilables ───
// Cardio Z2 elegible en el día flexible. La bici existe porque ese día cae en
// turno C: 12h de pie dejan pies, tibias y sóleo castigados, y correr encima
// carga justo esos tejidos. Mismo estímulo aeróbico, sin ese coste.
export const CARDIO_FLEXIBLE = ['running', 'ciclismo'];

export const COMPLEMENTOS = {
  calistenia: {
    label: 'Calistenia',
    permite: ['natacion', 'running', 'descanso'],
    motivoBloqueo: 'Duplicaría patrones y volumen que ya haces en el gimnasio con más carga.',
    cortaSobre: ['descanso'],
    ejerciciosBloquePierna: ['CAL-4'],
  },
};

// ─── v6 · Prioridad por tipo de turno (A2) ───
export const PRIORIDAD_TURNO = {
  L: ['gym', 'cardio', 'descanso'],   // preferentemente gym, cualquier hora
  P: ['gym', 'cardio', 'descanso'],   // preferentemente gym, tarde tras dormir
  N: ['gym', 'cardio'],               // solo mañana o mediodía (S5)
  C: ['descanso'],                    // nunca gym ni natación; aquí vive el flexible
};

// ─── v6 · La única cola (A2) ───
// Ninguna transición consecutiva solapa músculos. NUNCA se reinicia.
export const SECUENCIA_GYM = ['gymA', 'gymC1', 'gymD', 'gymC2', 'gymB'];


// ─── v6.1 · Natación · rotación de sesiones ───
// Dos bloques con propósitos distintos que no compiten: A mantiene el nivel de
// nadador completo, B construye base de crawl para triatlón.
// Con 2 sesiones semanales cada una reaparece cada 3 semanas.
// Contador persistente derivado del ancla, igual que la cola de gym.
export const SECUENCIA_NATACION = ['natA1', 'natB1', 'natA2', 'natB2', 'natA3', 'natB3'];

// El test de CSS sustituye a una B1 cada 6-8 semanas: comparten sistema
// energético y estructura, así que no descuadra la rotación.
export const NATACION_CSS = {
  sustituye: 'natB1',
  cadaSemanas: 6,   // al esperar a la siguiente B1 el hueco real cae en 6-8 semanas
  formula: 'CSS (s/100m) = (400 − 200) ÷ (tiempo400 − tiempo200)',
  ritmos: [
    { clave: 'CSS-5',  desc: '5 s más rápido por 100 m', uso: 'Series cortas, velocidad' },
    { clave: 'CSS',    desc: 'Tu ritmo umbral exacto',   uso: 'Series principales de umbral' },
    { clave: 'CSS+5',  desc: '5 s más lento por 100 m',  uso: 'Aeróbico sostenido' },
    { clave: 'CSS+10', desc: '10 s más lento',           uso: 'Recuperación activa, series largas' },
  ],
  // Con 25 m libre en 16 s, el CSS debería caer entre 1:30 y 1:45 / 100 m
  estimado: { min: '1:30', max: '1:45' },
};

// Máximo de palas por sesión. Con 29-32 series de gimnasio con mucho press y
// mucho tirón, el hombro ya lleva carga alta y las palas multiplican la fuerza
// sobre el manguito. Si aparece molestia, lo primero que sale son las palas —
// nunca el face pull, que es lo que protege.
export const PALAS_MAX_M = 500;

// ─── v6 · Regla S7 · frecuencia de pierna ───
// Separación MÍNIMA entre días de pierna: 2-3 días. Ese suelo sí se cumple.
// El objetivo semanal NO es 2 sesiones: la secuencia tiene 2 días de pierna de
// cada 5, así que a 3 gym por semana salen 3 × 2/5 = 1.2. Llegar a 2 exigiría
// 5 gym semanales, y la rota de 4 días no los deja (los turnos C no admiten gym).
// El objetivo real, y el que verifica el banco de pruebas, es 1-1.5.
export const S7_PIERNA = {
  separacionMinimaDias: 2,
  objetivoSemanalMin: 1,
  objetivoSemanalMax: 1.5,
  nota: 'Objetivo 1-1.5 sesiones de pierna por semana, con separación mínima de 2-3 días.',
};

// ─── v6 · Horarios de la piscina universitaria (N5) ───
// Cada franja dura 60 min (~52 min de agua = 2.000-2.400 m). Domingo cerrado.
// El generador elige UNA franja por día, así que no valida solapes entre franjas
// consecutivas: al pasar de 45 a 60 min no hay nada que recalcular ahí.
export const PISCINA_DURACION_MIN = 60;
export const PISCINA = {
  Lun: { franjas: [12, 13, 14, 15, 16, 17], guiado: [13, 14, 16] },
  Mar: { franjas: [7, 8, 12, 13, 14, 16],   guiado: [7, 8, 13] },
  Mié: { franjas: [13, 14, 15, 17, 18],     guiado: [14, 18] },
  Jue: { franjas: [7, 12, 13, 14, 15, 16],  guiado: [7, 13, 14] },
  Vie: { franjas: [7, 8, 12, 13],           guiado: [7, 8, 13] },
  Sáb: { franjas: [7],                      guiado: [7] },
  Dom: { franjas: [],                       guiado: [] },
};

// Ventanas de entrenamiento por turno, para la asignación flexible de natación.
// Prioridad L → N → P. Nunca turno C (la piscina cierra antes de que salga) ni domingo.
export const VENTANA_PISCINA = {
  L: { desde: 0,  hasta: 24, prioridad: 1 },
  N: { desde: 7,  hasta: 13, prioridad: 2 },  // mañanas y mediodías
  P: { desde: 15, hasta: 19, prioridad: 3 },  // tardes, tras dormir
  C: null,
};

// Sesiones: etiquetas cortas para el calendario.
//   label → abreviatura, la que se ve en la cuadrícula del mes
//   tipo  → descripción, para el selector y la biblioteca
//   grupo → categoría del menú agrupado (de aquí salen las secciones, no del JSX)
export const GRUPOS_SESION = {
  gym:        { label: 'Gym', icon: 'dumbbell', color: '#22c55e' },
  calistenia: { label: 'Calistenia', icon: 'home', color: '#a855f7' },
  natacion:   { label: 'Natación', icon: 'waves', color: '#06b6d4' },
  cardio:     { label: 'Cardio', icon: 'run', color: '#0891b2' },
  descanso:   { label: 'Descanso', icon: 'moon', color: '#64748b' },
};

export const SESION_INFO = {
  gymC1: { label: 'Gym C1', color: '#15803d', icon: 'dumbbell', tipo: 'Pierna pesada', grupo: 'gym' },
  gymC2: { label: 'Gym C2', color: '#65a30d', icon: 'dumbbell', tipo: 'Pierna volumen', grupo: 'gym' },
  gymA:  { label: 'Gym A',  color: '#22c55e', icon: 'dumbbell', tipo: 'Empuje superior', grupo: 'gym' },
  gymB:  { label: 'Gym B',  color: '#16a34a', icon: 'dumbbell', tipo: 'Tracción superior', grupo: 'gym' },
  gymD:  { label: 'Gym D',  color: '#4ade80', icon: 'dumbbell', tipo: 'Torso completo', grupo: 'gym' },
  calistenia: { label: 'Calistenia', color: '#a855f7', icon: 'home', tipo: 'Full body + gesto', grupo: 'calistenia' },
  natacion:   { label: 'Natación', color: '#06b6d4', icon: 'waves', tipo: 'Aeróbico', grupo: 'natacion' },
  natA1: { label: 'Swim A1', color: '#06b6d4', icon: 'waves', tipo: 'Técnica de crawl', grupo: 'natacion' },
  natA2: { label: 'Swim A2', color: '#06b6d4', icon: 'waves', tipo: 'Espalda y pecho', grupo: 'natacion' },
  natA3: { label: 'Swim A3', color: '#06b6d4', icon: 'waves', tipo: 'Estilos combinados', grupo: 'natacion' },
  natB1: { label: 'Swim B1', color: '#0891b2', icon: 'waves', tipo: 'Umbral', grupo: 'natacion' },
  natB2: { label: 'Swim B2', color: '#0891b2', icon: 'waves', tipo: 'Aguas abiertas', grupo: 'natacion' },
  natB3: { label: 'Swim B3', color: '#0891b2', icon: 'waves', tipo: 'Ritmo variable', grupo: 'natacion' },
  natCSS: { label: 'Test CSS', color: '#0e7490', icon: 'waves', tipo: 'Test de umbral', grupo: 'natacion' },
  running:    { label: 'Running', color: '#0891b2', icon: 'run', tipo: 'Z2', grupo: 'cardio' },
  ciclismo:   { label: 'Bici', color: '#0284c7', icon: 'run', tipo: 'Z2 sin impacto', grupo: 'cardio' },
  descanso:   { label: 'Descanso', color: '#64748b', icon: 'moon', tipo: 'Recuperación', grupo: 'descanso' },
};

// ═══════════════ TAXONOMÍA DE GRUPOS MUSCULARES (v6) ═══════════════
// Usada por las estadísticas de volumen. Series efectivas por músculo:
//   (series × 1.0 si es primario) + (series × 0.5 si es secundario)
// Franja productiva para principiante: 8-12 series/semana por grupo.
export const MUSCULOS = {
  // Tren superior — empuje
  pecho:               { label: 'Pecho',           cat: 'empuje',  color: '#22c55e' },
  deltoides_anterior:  { label: 'Deltoides ant.',  cat: 'empuje',  color: '#22c55e' },
  deltoides_medio:     { label: 'Deltoides medio', cat: 'empuje',  color: '#22c55e' },
  triceps:             { label: 'Tríceps',         cat: 'empuje',  color: '#22c55e' },
  // Tren superior — tracción
  dorsal:              { label: 'Dorsal',          cat: 'traccion', color: '#16a34a' },
  espalda_media:       { label: 'Espalda media',   cat: 'traccion', color: '#16a34a' },
  trapecio:            { label: 'Trapecio',        cat: 'traccion', color: '#16a34a' },
  deltoides_posterior: { label: 'Deltoides post.', cat: 'traccion', color: '#16a34a' },
  biceps:              { label: 'Bíceps',          cat: 'traccion', color: '#16a34a' },
  braquial:            { label: 'Braquial',        cat: 'traccion', color: '#16a34a' },
  antebrazo:           { label: 'Antebrazo',       cat: 'traccion', color: '#16a34a' },
  // Tren inferior
  cuadriceps:          { label: 'Cuádriceps',      cat: 'pierna',  color: '#65a30d' },
  isquios:             { label: 'Isquios',         cat: 'pierna',  color: '#65a30d' },
  gluteo:              { label: 'Glúteo',          cat: 'pierna',  color: '#65a30d' },
  gluteo_medio:        { label: 'Glúteo medio',    cat: 'pierna',  color: '#65a30d' },
  aductores:           { label: 'Aductores',       cat: 'pierna',  color: '#65a30d' },
  gemelo:              { label: 'Gemelo',          cat: 'pierna',  color: '#65a30d' },
  soleo:               { label: 'Sóleo',           cat: 'pierna',  color: '#65a30d' },
  // Core
  core_antiextension:  { label: 'Core anti-ext.',  cat: 'core',    color: '#06b6d4' },
  core_antirotacion:   { label: 'Core anti-rot.',  cat: 'core',    color: '#06b6d4' },
  core_antilateral:    { label: 'Core anti-lat.',  cat: 'core',    color: '#06b6d4' },
  erectores:           { label: 'Erectores',       cat: 'core',    color: '#06b6d4' },
};

export const CAT_MUSCULO = {
  empuje:   { label: 'Empuje',   color: '#22c55e' },
  traccion: { label: 'Tracción', color: '#16a34a' },
  pierna:   { label: 'Pierna',   color: '#65a30d' },
  core:     { label: 'Core',     color: '#06b6d4' },
};

// Franja productiva semanal por grupo (principiante). Fuera de [min,max] → aviso ámbar.
export const RANGO_VOLUMEN = { objetivoMin: 8, objetivoMax: 12, min: 6, max: 16 };

// ═══════════════ CALENDARIO ═══════════════
// El array CALENDARIO_DEFAULT de la v5 (31 días escritos a mano) SE ELIMINÓ.
// El calendario lo produce ahora src/generador.js a partir del ancla de la rota.
// MES_INFO también desapareció: el mes es estado de la app, no una constante.

export const DIAS_SEMANA = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

// ═══════════════ SESIONES v6 ═══════════════
// Estructura de cada sesión: Parte 1 (series rectas, compuestos, progresión lineal)
//                            Parte 2 (bi-serie compuesto secundario + aislamiento)
//                            Parte 3 (bi-series aislamiento + aislamiento)
//                            Finisher (acarreo, uno solo por sesión — E9)
//
// Campos de ejercicio:
//   parte: 1 | 2 | 3 | 'finisher'
//   lineal: true            = progresión lineal en kg (compuestos de Parte 1, P1)
//   progresion: '+2.5 kg'   = incremento por sesión, o 'carga' si es libre
//   rir: '1-2'              = doble progresión (aislamientos)
//   musculos: { primario: [], secundario: [] }   ← metadata de volumen (v6)
//   [nuevo:true]    = movimiento nuevo o modificado en la v6 (badge)
//   [opcional:true] = ejercicio con * (primero en la lista de recorte, R2)
//   [lastre:true]   = registro de carga en mochila/cinturón
//   [acarreo:true]  = registro de distancia + carga
//   [iso:true]      = registro de segundos (isométrico)
//   [bs:'BS1', bstipo:'ant'|'nc'] = bi-serie (E8)

export const SESIONES = {
  gymA: {
    nombre: 'Gym A — Empuje superior', subtitulo: 'Pecho · hombro · tríceps · carga real', color: '#22c55e',
    duracion: '~110 min · 35 series',
    chequeo: 'Banca y press militar son los DOS lifts con progresión lineal del día: van primero y la señal debe salir limpia. N1: 2 series de aproximación antes del primer compuesto de cada patrón. El face pull de la BS1 es obligatorio y no se recorta nunca (E6) — es el contrapeso a 10 series de press. Si fallas las reps dos sesiones seguidas en un lift, bajas el 10% y vuelves a subir (P6).',
    ejercicios: [
      { id: 'A-1', parte: 1, nombre: 'Press banca con barra', series: 4, reps: '5-8', lineal: true, progresion: '+2.5 kg', descanso: '3 min', nota: 'Prioridad #1. Excéntrica 3s, sin rebote, escápulas retraídas.',
        musculos: { primario: ['pecho', 'triceps'], secundario: ['deltoides_anterior'] } },
      { id: 'A-2', parte: 1, nombre: 'Press militar sentado mancuernas', series: 3, reps: '6-8', lineal: true, progresion: '+2.5 kg', descanso: '2.5 min', nota: 'PROMOVIDO a lift principal en la v6. Ya no es mantenimiento: ahora progresa.', nuevo: true,
        musculos: { primario: ['deltoides_anterior', 'triceps'], secundario: ['deltoides_medio'] } },

      { id: 'A-3', parte: 2, nombre: 'Press inclinado mancuernas 30°', series: 3, reps: '8-12', rir: '1-2', descanso: '60s', nota: '30° no más: si subes el banco, el trabajo se va al hombro. Empareja con face pull (no solapa).', bs: 'BS1', bstipo: 'ant',
        musculos: { primario: ['pecho', 'deltoides_anterior'], secundario: ['triceps'] } },
      { id: 'A-4', parte: 2, nombre: 'Face pull', series: 3, reps: '15-20', rir: '1-2', descanso: '60s', nota: 'OBLIGATORIO (E6). Contrapeso a 10 series de press. Salud de hombro.', bs: 'BS1', bstipo: 'ant',
        musculos: { primario: ['deltoides_posterior'], secundario: ['trapecio', 'espalda_media'] } },

      { id: 'A-5', parte: 3, nombre: 'Aperturas en polea', series: 3, reps: '12-15', rir: '1-2', descanso: '45s', nota: 'Pectoral en estiramiento profundo.', bs: 'BS2', bstipo: 'nc',
        musculos: { primario: ['pecho'], secundario: [] } },
      { id: 'A-6', parte: 3, nombre: 'Elevación lateral en polea', series: 3, reps: '12-20', rir: '1-2', descanso: '45s', nota: 'Deltoides medio (tu déficit).', bs: 'BS2', bstipo: 'nc',
        musculos: { primario: ['deltoides_medio'], secundario: [] } },
      { id: 'A-7', parte: 3, nombre: 'Extensión tríceps overhead', series: 3, reps: '10-15', rir: '1-2', descanso: '45s', nota: 'Cabeza larga en longitud larga.', bs: 'BS3', bstipo: 'nc',
        musculos: { primario: ['triceps'], secundario: [] } },
      { id: 'A-8', parte: 3, nombre: 'Elevación lateral mancuerna', series: 3, reps: '15-25', rir: '1-2', descanso: '45s', nota: 'Segunda dosis de deltoides medio.', bs: 'BS3', bstipo: 'nc',
        musculos: { primario: ['deltoides_medio'], secundario: [] } },
      { id: 'A-9', parte: 3, nombre: 'Extensión tríceps polea (cuerda)', series: 3, reps: '12-15', rir: '1-2', descanso: '45s', nota: 'Segunda dosis de tríceps, rango alto.', bs: 'BS4', bstipo: 'nc',
        musculos: { primario: ['triceps'], secundario: [] } },
      { id: 'A-10', parte: 3, nombre: 'Pallof press', series: 3, reps: '10-12/lado', rir: '1-2', descanso: '45s', nota: 'Core anti-rotación. Empuja recto, no dejes que el torso gire ni un grado.', bs: 'BS4', bstipo: 'nc',
        musculos: { primario: ['core_antirotacion'], secundario: [] } },
      { id: 'A-11', parte: 'finisher', nombre: 'Práctica de carga real', series: 4, reps: '20-45s', rir: '—', descanso: '2-3 min', nota: 'EL TRABAJO MÁS ESPECÍFICO DE TU OBJETIVO. Vivía en la calistenia; al dejar esta de ocupar día propio se movió aquí, que es la única sesión sin acarreo y llega con pierna y espalda frescas. Levanta desde sentadilla, pégala al pecho, codos contra las costillas. Protocolo completo en el Anexo A.', nuevo: true, iso: true,
        musculos: { primario: ['erectores', 'core_antiextension'], secundario: ['cuadriceps', 'gluteo', 'antebrazo', 'trapecio'] } },
      { id: 'A-12', parte: 'finisher', nombre: 'Escaleras cargando', series: 1, reps: '1 tramo', rir: '—', descanso: '2 min', nota: 'Solo cuando el bloque de 45s se sienta cómodo.', nuevo: true, opcional: true,
        musculos: { primario: ['cuadriceps', 'gluteo'], secundario: ['erectores', 'core_antiextension'] } },
    ]
  },

  gymC1: {
    nombre: 'Gym C1 — Pierna pesada', subtitulo: 'Pierna pesada · CERO torso', color: '#15803d',
    duracion: '~105 min · 31 series',
    chequeo: 'Tres compuestos con progresión lineal: sentadilla +5 kg, Zercher +2.5 kg, RDL +5 kg. N1: 2 series de aproximación antes del primero de cada patrón. Sem 1-3: el Zercher deliberadamente ligero, debe sentirse fácil (L1). Si fallas las reps dos sesiones seguidas, bajas el 10% (P6). Separación mínima con el otro día de pierna: 2-3 días (S7). Con 3 gym por semana la cadencia real es de 1-1.5 sesiones de pierna semanales.',
    ejercicios: [
      { id: 'C1-1', parte: 1, nombre: 'Sentadilla trasera con barra', series: 4, reps: '5-8', lineal: true, progresion: '+5 kg', descanso: '3 min', nota: 'Prioridad del día. Profundidad mínimo paralelo. Alt: hack squat.',
        musculos: { primario: ['cuadriceps', 'gluteo'], secundario: ['erectores', 'isquios'] } },
      { id: 'C1-2', parte: 1, nombre: 'Sentadilla Zercher', series: 3, reps: '6-8', lineal: true, progresion: '+2.5 kg', descanso: '2.5 min', nota: 'Barra en el pliegue del codo, pegada al pecho. Codos SIEMPRE contra las costillas. Usa pad. Limitado por postura → va temprano (E5).', nuevo: true,
        musculos: { primario: ['cuadriceps', 'erectores'], secundario: ['gluteo', 'core_antiextension'] } },
      { id: 'C1-3', parte: 1, nombre: 'Peso muerto rumano', series: 3, reps: '6-10', lineal: true, progresion: '+5 kg', descanso: '2.5 min', nota: 'Isquio en longitud larga. Cadera atrás, tibias verticales, barra pegada al muslo.',
        musculos: { primario: ['isquios', 'gluteo'], secundario: ['erectores', 'trapecio'] } },

      { id: 'C1-4', parte: 2, nombre: 'Prensa 45°', series: 3, reps: '10-15', rir: '1-2', descanso: '90s', nota: 'Empareja con gemelo sentado (no solapa).', bs: 'BS1', bstipo: 'nc',
        musculos: { primario: ['cuadriceps'], secundario: ['gluteo'] } },
      { id: 'C1-5', parte: 2, nombre: 'Gemelo sentado (sóleo)', series: 3, reps: '12-20', rir: '1-2', descanso: '60s', nota: 'Rodilla flexionada = sóleo.', bs: 'BS1', bstipo: 'nc',
        musculos: { primario: ['soleo'], secundario: [] } },

      { id: 'C1-6', parte: 3, nombre: 'Extensión de cuádriceps', series: 3, reps: '12-20', rir: '1-2', descanso: '45s', nota: 'Antagonista del curl femoral.', bs: 'BS2', bstipo: 'ant',
        musculos: { primario: ['cuadriceps'], secundario: [] } },
      { id: 'C1-7', parte: 3, nombre: 'Curl femoral sentado', series: 3, reps: '8-12', rir: '1-2', descanso: '45s', nota: 'Sentado > tumbado.', bs: 'BS2', bstipo: 'ant',
        musculos: { primario: ['isquios'], secundario: [] } },
      { id: 'C1-8', parte: 3, nombre: 'Hip thrust con barra', series: 3, reps: '8-12', rir: '1-2', descanso: '60s', nota: 'Glúteo en acortamiento máximo. Pausa 1s arriba, costillas abajo.', bs: 'BS3', bstipo: 'nc',
        musculos: { primario: ['gluteo'], secundario: ['isquios'] } },
      { id: 'C1-9', parte: 3, nombre: 'Gemelo de pie', series: 3, reps: '8-12', rir: '1-2', descanso: '45s', nota: 'Rodilla extendida = gastrocnemio. Pausa 2s abajo.', bs: 'BS3', bstipo: 'nc',
        musculos: { primario: ['gemelo'], secundario: [] } },
      { id: 'C1-10', parte: 3, nombre: 'Abductor en máquina', series: 3, reps: '15-20', rir: '1-2', descanso: '45s', nota: 'Glúteo medio, estabiliza rodilla.',
        musculos: { primario: ['gluteo_medio'], secundario: [] } },
    ]
  },

  gymD: {
    nombre: 'Gym D — Torso completo', subtitulo: 'Empuje + tracción · equilibrio', color: '#4ade80',
    duracion: '~90 min · 29 series',
    chequeo: 'Única sesión donde empuje y tracción conviven a propósito: mantiene alta la frecuencia de tus dos puntos débiles. Segunda dosis semanal de banca y de jalón, las dos con progresión lineal. El farmer\'s walk es el único acarreo del día (E9) y va al final por estar limitado por agarre (E5). En la secuencia v6, D queda encajada entre C1 y C2, así que no toca ni A ni B.',
    ejercicios: [
      { id: 'D-1', parte: 1, nombre: 'Press banca con barra', series: 4, reps: '5-8', lineal: true, progresion: '+2.5 kg', descanso: '2.5 min', nota: 'Segunda dosis de tu punto débil #1.',
        musculos: { primario: ['pecho', 'triceps'], secundario: ['deltoides_anterior'] } },
      { id: 'D-2', parte: 1, nombre: 'Dominada o jalón pesado', series: 4, reps: '6-10', lineal: true, progresion: 'carga', descanso: '2.5 min', nota: 'Punto débil #2. Progresa en CARGA. SIN correas en dominada / CON en jalón.', lastre: true,
        musculos: { primario: ['dorsal', 'biceps'], secundario: ['espalda_media', 'braquial', 'antebrazo'] } },

      { id: 'D-3', parte: 2, nombre: 'Press inclinado mancuernas 30°', series: 3, reps: '8-12', rir: '1-2', descanso: '90s', nota: 'Pectoral superior. Antagonista real del remo.', bs: 'BS1', bstipo: 'ant',
        musculos: { primario: ['pecho', 'deltoides_anterior'], secundario: ['triceps'] } },
      { id: 'D-4', parte: 2, nombre: 'Remo con apoyo en pecho', series: 3, reps: '8-12', rir: '1-2', descanso: '90s', nota: 'Espalda media sin carga lumbar. Antagonista del press inclinado.', bs: 'BS1', bstipo: 'ant',
        musculos: { primario: ['espalda_media', 'dorsal'], secundario: ['biceps', 'deltoides_posterior'] } },

      { id: 'D-5', parte: 3, nombre: 'Elevación lateral', series: 3, reps: '12-20', rir: '1-2', descanso: '45s', nota: 'Deltoides medio.', bs: 'BS2', bstipo: 'nc',
        musculos: { primario: ['deltoides_medio'], secundario: [] } },
      { id: 'D-6', parte: 3, nombre: 'Curl inverso', series: 3, reps: '12-15', rir: '1-2', descanso: '45s', nota: 'Braquiorradial + extensores del antebrazo. Muñeca firme. Usa 50-60% del peso de tu curl normal.', nuevo: true, bs: 'BS2', bstipo: 'nc',
        musculos: { primario: ['braquial', 'antebrazo'], secundario: ['biceps'] } },
      { id: 'D-7', parte: 3, nombre: 'Face pull o pájaro', series: 3, reps: '15-20', rir: '1-2', descanso: '45s', nota: 'Deltoides posterior.', bs: 'BS3', bstipo: 'nc',
        musculos: { primario: ['deltoides_posterior'], secundario: ['trapecio'] } },
      { id: 'D-8', parte: 3, nombre: 'Extensión tríceps overhead', series: 3, reps: '10-15', rir: '1-2', descanso: '45s', nota: 'Cabeza larga del tríceps.', bs: 'BS3', bstipo: 'nc',
        musculos: { primario: ['triceps'], secundario: [] } },

      { id: 'D-9', parte: 'finisher', nombre: "Farmer's walk", series: 3, reps: '40 m', rir: '—', descanso: '90s', nota: 'Único acarreo del día. Hombros atrás y abajo, pecho alto, pasos cortos. Progresa en carga mientras mantengas la postura (P2).', nuevo: true, acarreo: true,
        musculos: { primario: ['antebrazo', 'trapecio'], secundario: ['core_antilateral', 'erectores'] } },
    ]
  },

  gymC2: {
    nombre: 'Gym C2 — Pierna volumen', subtitulo: 'Pierna volumen · sin barra a la espalda', color: '#65a30d',
    duracion: '~100 min · 31 series',
    chequeo: 'Sin carga axial: ninguna barra a la espalda. Secuencia deliberada prensa → bear hug → RDL, porque el bear hug necesita erectores frescos. Es el único acarreo del día (E9) y va temprano por estar limitado por postura (E5). Sem 1-3: bear hug deliberadamente ligero (L1). El step-up y la búlgara ALTERNAN por sesión.',
    ejercicios: [
      { id: 'C2-1', parte: 1, nombre: 'Prensa 45°', series: 4, reps: '10-15', lineal: true, progresion: '+5 kg', descanso: '2.5 min', nota: 'Motor del día. Pies a media altura, ROM completo sin despegar la lumbar.',
        musculos: { primario: ['cuadriceps'], secundario: ['gluteo', 'isquios'] } },
      { id: 'C2-2', parte: 1, nombre: 'Complejo bear hug', series: 3, reps: '6 sent + 30-40 m', lineal: true, progresion: 'carga', descanso: '2 min', nota: 'Lo más parecido a cargar a una persona. Objeto abrazado AL ESTERNÓN: si baja del ombligo, para y recolócalo. Protocolo completo en el Anexo A.', nuevo: true, acarreo: true,
        musculos: { primario: ['cuadriceps', 'erectores', 'gluteo'], secundario: ['core_antiextension', 'antebrazo'] } },
      { id: 'C2-3', parte: 1, nombre: 'Peso muerto rumano con mancuernas', series: 3, reps: '8-12', lineal: true, progresion: 'carga', descanso: '2 min', nota: 'Mismo patrón que el RDL con barra, sin carga axial.',
        musculos: { primario: ['isquios', 'gluteo'], secundario: ['erectores', 'antebrazo'] } },

      { id: 'C2-4', parte: 2, nombre: 'Step-up cajón alto (goblet) ⇄ Búlgara', series: 3, reps: '8-10/pierna', rir: '1-2', descanso: '90s', nota: 'ALTERNAN por sesión: una C2 step-up, la siguiente búlgara. Step-up: pie completo, empuja con el talón de arriba, sin impulso, bajada 3s.', nuevo: true, bs: 'BS1', bstipo: 'nc',
        musculos: { primario: ['cuadriceps', 'gluteo'], secundario: ['isquios', 'gluteo_medio', 'aductores'] } },
      { id: 'C2-5', parte: 2, nombre: 'Gemelo sentado (sóleo)', series: 3, reps: '12-20', rir: '1-2', descanso: '60s', nota: 'No solapa con el step-up.', bs: 'BS1', bstipo: 'nc',
        musculos: { primario: ['soleo'], secundario: [] } },

      { id: 'C2-6', parte: 3, nombre: 'Curl femoral sentado', series: 3, reps: '8-12', rir: '1-2', descanso: '45s', nota: 'Antagonista de la extensión.', bs: 'BS2', bstipo: 'ant',
        musculos: { primario: ['isquios'], secundario: [] } },
      { id: 'C2-7', parte: 3, nombre: 'Extensión de cuádriceps', series: 3, reps: '12-20', rir: '1-2', descanso: '45s', nota: 'Recto femoral con cadera extendida.', bs: 'BS2', bstipo: 'ant',
        musculos: { primario: ['cuadriceps'], secundario: [] } },
      { id: 'C2-8', parte: 3, nombre: 'Hiperextensión 45°', series: 3, reps: '12-15', rir: '1-2', descanso: '60s', nota: 'Empuja con glúteo, no con lumbar.', bs: 'BS3', bstipo: 'nc',
        musculos: { primario: ['gluteo', 'erectores'], secundario: ['isquios'] } },
      { id: 'C2-9', parte: 3, nombre: 'Gemelo de pie', series: 3, reps: '8-12', rir: '1-2', descanso: '45s', nota: 'Rodilla extendida = gastrocnemio. Pausa 2s abajo.', bs: 'BS3', bstipo: 'nc',
        musculos: { primario: ['gemelo'], secundario: [] } },
      { id: 'C2-10', parte: 3, nombre: 'Hip thrust', series: 3, reps: '8-12', rir: '1-2', descanso: '60s', nota: 'Glúteo directo. Pausa 1s arriba.',
        musculos: { primario: ['gluteo'], secundario: ['isquios'] } },
    ]
  },

  gymB: {
    nombre: 'Gym B — Tracción superior', subtitulo: 'Espalda · bíceps · braquial', color: '#16a34a',
    duracion: '~100 min · 32 series',
    chequeo: 'Jalón y remo con progresión lineal en carga. Cuando llegues a 8 dominadas a peso corporal, cambias a progresión por lastre (E3). SIN correas en el jalón pesado / CON correas en remo y jalón neutro. El suitcase es el único acarreo (E9) y va al final por estar limitado por agarre (E5). El isométrico del curl martillo es tu métrica clave del objetivo: ANOTA EL TIEMPO.',
    ejercicios: [
      { id: 'B-1', parte: 1, nombre: 'Jalón pesado o dominada lastrada', series: 4, reps: '5-8', lineal: true, progresion: 'carga', descanso: '3 min', nota: 'Prioridad #2. Nunca al fallo. Alterna pronado/neutro. SIN correas.', lastre: true,
        musculos: { primario: ['dorsal', 'biceps'], secundario: ['espalda_media', 'braquial', 'antebrazo'] } },
      { id: 'B-2', parte: 1, nombre: 'Remo con apoyo en pecho', series: 4, reps: '8-12', lineal: true, progresion: 'carga', descanso: '2.5 min', nota: 'Espalda media sin carga lumbar. CON correas.',
        musculos: { primario: ['espalda_media', 'dorsal'], secundario: ['biceps', 'deltoides_posterior', 'trapecio'] } },

      { id: 'B-3', parte: 2, nombre: 'Jalón agarre neutro', series: 3, reps: '10-15', rir: '1-2', descanso: '60s', nota: 'Escápulas abajo, luego tira. CON correas. Empareja con core (no solapa).', bs: 'BS1', bstipo: 'nc',
        musculos: { primario: ['dorsal'], secundario: ['biceps', 'espalda_media'] } },
      { id: 'B-4', parte: 2, nombre: 'Rueda abdominal o plancha', series: 3, reps: '8-12 / 30-45s', rir: '1-2', descanso: '60s', nota: 'Core anti-extensión. Aquí vive TODO tu trabajo anti-extensión: no lo recortes.', bs: 'BS1', bstipo: 'nc',
        musculos: { primario: ['core_antiextension'], secundario: ['dorsal'] } },

      { id: 'B-5', parte: 3, nombre: 'Pullover en polea alta', series: 3, reps: '12-15', rir: '1-2', descanso: '45s', nota: 'Dorsal SIN que el bíceps intervenga.', bs: 'BS2', bstipo: 'nc',
        musculos: { primario: ['dorsal'], secundario: ['trapecio'] } },
      { id: 'B-6', parte: 3, nombre: 'Curl inclinado mancuernas 45-60°', series: 3, reps: '8-12', rir: '1-2', descanso: '45s', nota: 'Bíceps en longitud larga.', bs: 'BS2', bstipo: 'nc',
        musculos: { primario: ['biceps'], secundario: ['braquial'] } },
      { id: 'B-7', parte: 3, nombre: 'Pájaro o face pull', series: 3, reps: '15-20', rir: '1-2', descanso: '45s', nota: 'Deltoides posterior.', bs: 'BS3', bstipo: 'nc',
        musculos: { primario: ['deltoides_posterior'], secundario: ['trapecio'] } },
      { id: 'B-8', parte: 3, nombre: 'Curl martillo + isométrico final', series: 3, reps: '10-15', rir: '1-2', descanso: '45s', nota: 'En la ÚLTIMA serie, al terminar quédate con los codos a 90° y aguanta hasta el fallo. ANOTA EL TIEMPO. Solo tiempo hasta los 60s, después carga (P3).', nuevo: true, iso: true, bs: 'BS3', bstipo: 'nc',
        musculos: { primario: ['braquial', 'biceps'], secundario: ['antebrazo'] } },
      { id: 'B-9', parte: 3, nombre: 'Encogimiento', series: 3, reps: '10-15', rir: '1-2', descanso: '45s', nota: 'Trapecio. Con suitcase y farmer\'s ya recibe carga sobrada.', opcional: true,
        musculos: { primario: ['trapecio'], secundario: [] } },

      { id: 'B-10', parte: 'finisher', nombre: 'Suitcase carry', series: 3, reps: '30 m/lado', rir: '—', descanso: '90s', nota: 'Único acarreo del día. Torso 100% vertical, hombros nivelados. Si te inclinas, pesa demasiado y bajas peso (P2).', nuevo: true, acarreo: true,
        musculos: { primario: ['core_antilateral', 'antebrazo'], secundario: ['trapecio', 'erectores'] } },
      { id: 'B-11', parte: 'finisher', nombre: 'Dead hang', series: 1, reps: '30-45s', rir: '—', descanso: '—', nota: 'Solo descompresión de columna, no trabajo de agarre.', opcional: true,
        musculos: { primario: [], secundario: ['antebrazo'] } },
    ]
  },

  calistenia: {
    nombre: 'Calistenia Full Body', subtitulo: 'Complemento apilable · no ocupa día propio', color: '#a855f7',
    duracion: '~45 min',
    chequeo: 'NO es relleno: duplica la frecuencia de tus puntos débiles. Progresa por DIFICULTAD (escalera), no por banda. El bloque de pierna cambia de nivel según la distancia a tu día de pierna. La Parte 3 (práctica de carga real) es el trabajo más específico de todo el plan para tu objetivo — vale más que tres meses de gimnasio.',
    ejercicios: [
      { id: 'CAL-1', parte: 1, nombre: 'Dominadas (nivel escalera)', series: 3, reps: 'máx − 2', rir: '2', descanso: '2 min', nota: 'Escalera: neutro → pronado → pausa → ancho → una y media.',
        musculos: { primario: ['dorsal', 'biceps'], secundario: ['espalda_media', 'braquial', 'antebrazo'] } },
      { id: 'CAL-2', parte: 1, nombre: 'Fondos en paralelas (nivel escalera)', series: 3, reps: 'máx − 2', rir: '2', descanso: '2 min', nota: 'Escalera: banco → banda → completo → pausa → excéntrica 3s.',
        musculos: { primario: ['pecho', 'triceps'], secundario: ['deltoides_anterior'] } },

      { id: 'CAL-3', parte: 2, nombre: 'Flexiones (nivel escalera)', series: 3, reps: 'máx − 2', rir: '2', descanso: '45s', nota: 'Escalera: rodillas → estándar → diamante → declinada → arquero.', bs: 'BS1', bstipo: 'nc',
        musculos: { primario: ['pecho', 'triceps'], secundario: ['deltoides_anterior', 'core_antiextension'] } },
      { id: 'CAL-4', parte: 2, nombre: 'Bloque de pierna (nivel auto)', series: 3, reps: 'según nivel', rir: '2', descanso: '45s', nota: 'COMPLETO (48h+ desde/hasta pierna): búlgara 12-15/pierna. REDUCIDO (24h desde pierna): puente de glúteo 15-20. MÍNIMO (pierna esa misma mañana): solo movilidad.', bs: 'BS1', bstipo: 'nc',
        musculos: { primario: ['cuadriceps', 'gluteo'], secundario: ['isquios', 'aductores'] } },
      { id: 'CAL-5', parte: 2, nombre: 'Remo con banda o invertido', series: 3, reps: '12-15', rir: '1-2', descanso: '45s', nota: 'Espalda. Empareja con gemelo.', bs: 'BS2', bstipo: 'nc',
        musculos: { primario: ['espalda_media', 'dorsal'], secundario: ['biceps', 'deltoides_posterior'] } },
      { id: 'CAL-6', parte: 2, nombre: 'Gemelo a una pierna en escalón', series: 3, reps: '15-20', rir: '1-2', descanso: '45s', nota: 'ROM completo con pausa abajo.', bs: 'BS2', bstipo: 'nc',
        musculos: { primario: ['gemelo'], secundario: ['soleo'] } },
      { id: 'CAL-7', parte: 2, nombre: 'Elevación lateral con banda', series: 3, reps: '15-25', rir: '1-2', descanso: '40s', nota: 'Deltoides medio.', bs: 'BS3', bstipo: 'nc',
        musculos: { primario: ['deltoides_medio'], secundario: [] } },
      { id: 'CAL-8', parte: 2, nombre: 'Plancha o hollow hold', series: 3, reps: '30-45s', rir: '1-2', descanso: '40s', nota: 'Core anti-extensión.', bs: 'BS3', bstipo: 'nc',
        musculos: { primario: ['core_antiextension'], secundario: [] } },
      { id: 'CAL-9', parte: 2, nombre: 'Face pull con banda', series: 2, reps: '15-20', rir: '1-2', descanso: '40s', nota: 'Rotadores.', bs: 'BS4', bstipo: 'nc',
        musculos: { primario: ['deltoides_posterior'], secundario: ['trapecio'] } },
      { id: 'CAL-10', parte: 2, nombre: 'Puente de glúteo a una pierna', series: 2, reps: '12-15', rir: '1-2', descanso: '40s', nota: 'Glúteo.', bs: 'BS4', bstipo: 'nc',
        musculos: { primario: ['gluteo'], secundario: ['isquios'] } },

    ]
  },


  // ═══ NATACIÓN · BLOQUE A — técnica y estilos (mantiene el nivel de nadador completo) ═══
  natA1: {
    nombre: 'Swim A1 — Técnica de crawl', subtitulo: '2.000 m · ~52 min', color: '#06b6d4', duracion: '60 min',
    distancia: '2.000 m',
    chequeo: 'Con tu nivel, el margen de mejora no está en la técnica gruesa sino en el AGARRE del agua: por eso el catch-up y el puño cerrado. Palas: máximo 500 m por sesión — con 29-32 series de gimnasio con mucho press y tirón, tu hombro ya lleva carga alta y las palas multiplican la fuerza sobre el manguito. Si aparece molestia, lo primero que sale son las palas, nunca el face pull del gimnasio.',
    recortada: 'Palas 6×100 → 4×100 · aeróbico 400 → 300 · calma 200 → 100 (1.600 m)',
    ejercicios: [
      { id: 'A1-1', parte: 1, nombre: 'Calentamiento · crawl suave', series: 1, reps: '200 m', rir: '—', descanso: '—', nota: 'Soltar.', musculos: { primario: [], secundario: [] } },
      { id: 'A1-2', parte: 1, nombre: 'Calentamiento · espalda', series: 1, reps: '100 m', rir: '—', descanso: '—', nota: 'Movilidad de hombro.', musculos: { primario: [], secundario: [] } },
      { id: 'A1-3', parte: 1, nombre: 'Calentamiento · patada con tabla', series: 1, reps: '100 m', rir: '—', descanso: '—', nota: 'Activar.', musculos: { primario: [], secundario: [] } },
      { id: 'A1-4', parte: 2, nombre: 'Técnica · catch-up', series: 2, reps: '50 m', rir: '—', descanso: '20s', nota: 'La mano espera a la otra delante. Exagera el deslizamiento.', nuevo: true, musculos: { primario: [], secundario: [] } },
      { id: 'A1-5', parte: 2, nombre: 'Técnica · puño cerrado', series: 2, reps: '50 m', rir: '—', descanso: '20s', nota: 'Sin mano: obliga a usar el antebrazo. Ataca directamente tu agarre.', nuevo: true, musculos: { primario: [], secundario: [] } },
      { id: 'A1-6', parte: 2, nombre: 'Técnica · brazo único', series: 2, reps: '50 m', rir: '—', descanso: '20s', nota: 'Un brazo, el otro extendido. Alterna por largo.', musculos: { primario: [], secundario: [] } },
      { id: 'A1-7', parte: 2, nombre: 'Técnica · arrastre de dedos', series: 2, reps: '50 m', rir: '—', descanso: '20s', nota: 'Codo alto en la recuperación.', musculos: { primario: [], secundario: [] } },
      { id: 'A1-8', parte: 3, nombre: 'Fuerza · con palas', series: 6, reps: '100 m', rir: '—', descanso: '20s', nota: 'Ritmo CSS+5. Foco en el agarre, NO en la velocidad. 600 m de palas: si el hombro va justo, baja a 4×100.', palas: true, musculos: { primario: [], secundario: [] } },
      { id: 'A1-9', parte: 3, nombre: 'Aeróbico · crawl continuo', series: 1, reps: '400 m', rir: '—', descanso: '—', nota: 'CSS+5. Respiración bilateral cada 3.', musculos: { primario: [], secundario: [] } },
      { id: 'A1-10', parte: 'finisher', nombre: 'Vuelta a la calma', series: 1, reps: '200 m', rir: '—', descanso: '—', nota: 'Suave, alternando estilos.', musculos: { primario: [], secundario: [] } },
    ]
  },

  natA2: {
    nombre: 'Swim A2 — Espalda y pecho', subtitulo: '2.300 m · ~55 min', color: '#06b6d4', duracion: '60 min',
    distancia: '2.300 m',
    chequeo: 'Tu pecho es 6/10 y tu espalda 7/10. Esta es la sesión que evita que se degraden. NO busca convertirlos en 9/10: eso exigiría más frecuencia de la que tienes con 2 sesiones semanales.',
    recortada: 'Un 100 de cada estilo · calentamiento 400 → 300 · aeróbico 300 → 200 (1.700 m)',
    ejercicios: [
      { id: 'A2-1', parte: 1, nombre: 'Calentamiento · crawl suave', series: 1, reps: '300 m', rir: '—', descanso: '—', nota: '', musculos: { primario: [], secundario: [] } },
      { id: 'A2-2', parte: 1, nombre: 'Calentamiento · patada con tabla', series: 1, reps: '100 m', rir: '—', descanso: '—', nota: '', musculos: { primario: [], secundario: [] } },
      { id: 'A2-3', parte: 2, nombre: 'Espalda · brazo único', series: 2, reps: '50 m', rir: '—', descanso: '20s', nota: 'Rotación de CADERA, no de hombro.', musculos: { primario: [], secundario: [] } },
      { id: 'A2-4', parte: 2, nombre: 'Espalda · aletas, brazos extendidos', series: 2, reps: '50 m', rir: '—', descanso: '20s', nota: 'Rotación pura.', musculos: { primario: [], secundario: [] } },
      { id: 'A2-5', parte: 2, nombre: 'Espalda · completo', series: 2, reps: '50 m', rir: '—', descanso: '20s', nota: '', musculos: { primario: [], secundario: [] } },
      { id: 'A2-6', parte: 2, nombre: 'Espalda · series', series: 4, reps: '100 m', rir: '—', descanso: '25s', nota: 'Ritmo constante.', musculos: { primario: [], secundario: [] } },
      { id: 'A2-7', parte: 3, nombre: 'Pecho · patada con tabla', series: 2, reps: '50 m', rir: '—', descanso: '20s', nota: 'Patada de pecho aislada.', musculos: { primario: [], secundario: [] } },
      { id: 'A2-8', parte: 3, nombre: 'Pecho · pull (pull buoy)', series: 2, reps: '50 m', rir: '—', descanso: '20s', nota: 'Brazada aislada.', musculos: { primario: [], secundario: [] } },
      { id: 'A2-9', parte: 3, nombre: 'Pecho · completo, 2 patadas por brazada', series: 2, reps: '50 m', rir: '—', descanso: '20s', nota: 'Exagerar el deslizamiento.', musculos: { primario: [], secundario: [] } },
      { id: 'A2-10', parte: 3, nombre: 'Pecho · series', series: 4, reps: '100 m', rir: '—', descanso: '25s', nota: '', musculos: { primario: [], secundario: [] } },
      { id: 'A2-11', parte: 3, nombre: 'Aeróbico · crawl', series: 1, reps: '300 m', rir: '—', descanso: '—', nota: 'CSS+5.', musculos: { primario: [], secundario: [] } },
      { id: 'A2-12', parte: 'finisher', nombre: 'Vuelta a la calma', series: 1, reps: '200 m', rir: '—', descanso: '—', nota: 'Suave.', musculos: { primario: [], secundario: [] } },
    ]
  },

  natA3: {
    nombre: 'Swim A3 — Estilos combinados', subtitulo: '2.000 m · ~50 min', color: '#06b6d4', duracion: '60 min',
    distancia: '2.000 m',
    chequeo: 'La mariposa está aquí como variedad y coordinación, NO como objetivo. Pasar de 4/10 a 7/10 exigiría 3-4 sesiones semanales dedicadas; con 2 sesiones totales sería tirar el tiempo. Disfrútala, no la persigas.',
    recortada: 'IM 4×100 → 3×100 · progresivos 8×50 → 6×50 · calma 200 → 100 (1.600 m)',
    ejercicios: [
      { id: 'A3-1', parte: 1, nombre: 'Calentamiento · crawl suave', series: 1, reps: '300 m', rir: '—', descanso: '—', nota: '', musculos: { primario: [], secundario: [] } },
      { id: 'A3-2', parte: 1, nombre: 'Calentamiento · espalda', series: 1, reps: '100 m', rir: '—', descanso: '—', nota: '', musculos: { primario: [], secundario: [] } },
      { id: 'A3-3', parte: 2, nombre: 'Mariposa con aletas', series: 8, reps: '25 m', rir: '—', descanso: '20s', nota: 'SOLO técnica. Ondulación y timing. Nunca busques volumen aquí.', musculos: { primario: [], secundario: [] } },
      { id: 'A3-4', parte: 2, nombre: 'Estilos · IM', series: 4, reps: '100 m', rir: '—', descanso: '30s', nota: '25 mariposa (con aletas) · 25 espalda · 25 pecho · 25 crawl.', musculos: { primario: [], secundario: [] } },
      { id: 'A3-5', parte: 3, nombre: 'Crawl · progresivos', series: 8, reps: '50 m', rir: '—', descanso: '20s', nota: 'Del CSS+10 al CSS−5 dentro de cada 50.', musculos: { primario: [], secundario: [] } },
      { id: 'A3-6', parte: 3, nombre: 'Aeróbico · crawl continuo', series: 1, reps: '400 m', rir: '—', descanso: '—', nota: 'CSS+5.', musculos: { primario: [], secundario: [] } },
      { id: 'A3-7', parte: 'finisher', nombre: 'Vuelta a la calma', series: 1, reps: '200 m', rir: '—', descanso: '—', nota: 'Suave.', musculos: { primario: [], secundario: [] } },
    ]
  },

  // ═══ NATACIÓN · BLOQUE B — crawl y umbral (base específica para triatlón) ═══
  natB1: {
    nombre: 'Swim B1 — Umbral', subtitulo: '2.100 m · ~55 min · La más importante para triatlón', color: '#0891b2', duracion: '60 min',
    distancia: '2.100 m',
    chequeo: 'La serie de 10×100 con solo 15s de descanso es lo que la hace umbral. Si los últimos salen 3-4 s más lentos que los primeros, empezaste demasiado rápido: la CONSISTENCIA importa más que la velocidad. Progresión: cuando hagas los 10 al mismo ritmo sin desmoronarte, sube a 12×100 o baja el descanso a 10s. En recortada NUNCA toques la serie de 10×100: es tu métrica de progreso y si un día haces 10 y otro 8 dejas de poder compararlas.',
    recortada: 'FUERA el bloque de velocidad (4×50) · calentamiento 300 → 200. La serie 10×100 se mantiene íntegra (1.700 m)',
    ejercicios: [
      { id: 'B1-1', parte: 1, nombre: 'Calentamiento · crawl suave', series: 1, reps: '300 m', rir: '—', descanso: '—', nota: '', musculos: { primario: [], secundario: [] } },
      { id: 'B1-2', parte: 1, nombre: 'Calentamiento · progresivos', series: 4, reps: '50 m', rir: '—', descanso: '20s', nota: '', musculos: { primario: [], secundario: [] } },
      { agua: true, id: 'B1-3', parte: 2, nombre: 'PRINCIPAL · 10×100 a ritmo CSS', series: 10, reps: '100 m', rir: '—', descanso: '15s', nota: 'El descanso corto es lo que la hace umbral. ANOTA LOS TIEMPOS de cada 100: es tu mejor indicador semana a semana.', nuevo: true, iso: true, musculos: { primario: [], secundario: [] } },
      { id: 'B1-4', parte: 3, nombre: 'Recuperación', series: 1, reps: '200 m', rir: '—', descanso: '—', nota: 'Muy suave.', musculos: { primario: [], secundario: [] } },
      { id: 'B1-5', parte: 3, nombre: 'Velocidad', series: 4, reps: '50 m', rir: '—', descanso: '30s', nota: 'Fuertes, CSS−5 o más rápido. Es lo primero que se recorta.', opcional: true, musculos: { primario: [], secundario: [] } },
      { id: 'B1-6', parte: 'finisher', nombre: 'Vuelta a la calma', series: 1, reps: '200 m', rir: '—', descanso: '—', nota: 'Suave.', musculos: { primario: [], secundario: [] } },
    ]
  },

  natB2: {
    nombre: 'Swim B2 — Continuo y aguas abiertas', subtitulo: '2.400 m · ~58 min', color: '#0891b2', duracion: '60 min',
    distancia: '2.400 m',
    chequeo: 'La sesión que MÁS transfiere al triatlón: distancia continua, sin descanso de pared, con orientación. Sighting = levantar los ojos hacia delante sin parar la brazada, como un cocodrilo. En triatlón no hay líneas en el fondo ni paredes; practicarlo en piscina es la única forma de que no te cueste el día de la prueba. Progresión del bloque largo: 800 → 1.000 → 1.200 m.',
    recortada: 'Bloque largo 800 → 600 · fuera las 4×100 finales (1.700 m)',
    ejercicios: [
      { id: 'B2-1', parte: 1, nombre: 'Calentamiento · crawl suave', series: 1, reps: '400 m', rir: '—', descanso: '—', nota: '', musculos: { primario: [], secundario: [] } },
      { agua: true, id: 'B2-2', parte: 2, nombre: 'Bloque largo continuo', series: 1, reps: '800 m', rir: '—', descanso: '—', nota: 'CSS+5. SIGHTING cada 8 brazadas. ANOTA EL TIEMPO.', nuevo: true, iso: true, musculos: { primario: [], secundario: [] } },
      { id: 'B2-3', parte: 2, nombre: 'Recuperación', series: 1, reps: '100 m', rir: '—', descanso: '—', nota: 'Suave.', musculos: { primario: [], secundario: [] } },
      { id: 'B2-4', parte: 2, nombre: 'Bloque medio continuo', series: 1, reps: '400 m', rir: '—', descanso: '—', nota: 'CSS. Sighting cada 10 brazadas.', musculos: { primario: [], secundario: [] } },
      { id: 'B2-5', parte: 3, nombre: 'Recuperación', series: 1, reps: '100 m', rir: '—', descanso: '—', nota: 'Suave.', musculos: { primario: [], secundario: [] } },
      { id: 'B2-6', parte: 3, nombre: 'Series', series: 4, reps: '100 m', rir: '—', descanso: '20s', nota: 'CSS. Salida cada 2:00 si tu CSS lo permite.', opcional: true, musculos: { primario: [], secundario: [] } },
      { id: 'B2-7', parte: 'finisher', nombre: 'Vuelta a la calma', series: 1, reps: '200 m', rir: '—', descanso: '—', nota: 'Suave.', musculos: { primario: [], secundario: [] } },
    ]
  },

  natB3: {
    nombre: 'Swim B3 — Ritmo variable', subtitulo: '2.200 m · ~55 min', color: '#0891b2', duracion: '60 min',
    distancia: '2.200 m',
    chequeo: 'El ritmo variable te enseña a SENTIR ritmos distintos, no solo a nadar rápido. En triatlón vas a necesitar controlar el ritmo desde el primer metro sin dejarte llevar por la salida. Progresión: 3 bloques → 4 bloques.',
    recortada: '3 bloques → 2 bloques · pull 4×100 → 3×100 (1.700 m)',
    ejercicios: [
      { id: 'B3-1', parte: 1, nombre: 'Calentamiento · crawl suave', series: 1, reps: '400 m', rir: '—', descanso: '—', nota: '', musculos: { primario: [], secundario: [] } },
      { id: 'B3-2', parte: 2, nombre: 'PRINCIPAL · 3 bloques de 4×100', series: 12, reps: '100 m', rir: '—', descanso: '20s / 60s entre bloques', nota: 'Ritmos dentro de cada bloque: CSS+10 → CSS+5 → CSS → CSS−5.', nuevo: true, musculos: { primario: [], secundario: [] } },
      { id: 'B3-3', parte: 3, nombre: 'Pull con pull buoy y palas', series: 4, reps: '100 m', rir: '—', descanso: '25s', nota: 'CSS+5. Foco en el agarre. 400 m de palas: no te pases del límite.', palas: true, musculos: { primario: [], secundario: [] } },
      { id: 'B3-4', parte: 'finisher', nombre: 'Vuelta a la calma', series: 1, reps: '200 m', rir: '—', descanso: '—', nota: 'Suave.', musculos: { primario: [], secundario: [] } },
    ]
  },

  natCSS: {
    nombre: 'Test de CSS', subtitulo: 'Hazlo en tu primera sesión', color: '#0e7490', duracion: '60 min',
    distancia: '1.700 m',
    chequeo: 'SIN ESTE NÚMERO, TODOS LOS RITMOS DEL PLAN SON ADIVINANZAS. CSS (s/100m) = (400 − 200) ÷ (tiempo400 − tiempo200). Ejemplo: 400 m en 6:40 (400 s) y 200 m en 3:10 (190 s) → 200 ÷ 210 = 0.952 m/s → 1:45/100 m. Con tu 25 m libre en 16 s, tu CSS debería caer entre 1:30 y 1:45. Repite el test cada 6-8 semanas sustituyendo una B1: comparten sistema energético, así que no descuadra la rotación.',
    ejercicios: [
      { id: 'CSS-1', parte: 1, nombre: 'Calentamiento · crawl suave', series: 1, reps: '400 m', rir: '—', descanso: '—', nota: '', musculos: { primario: [], secundario: [] } },
      { id: 'CSS-2', parte: 1, nombre: 'Activación · progresivos', series: 4, reps: '50 m', rir: '—', descanso: '20s', nota: '', musculos: { primario: [], secundario: [] } },
      { agua: true, id: 'CSS-3', parte: 2, nombre: 'TEST 1 · 400 m a tope', series: 1, reps: '400 m', rir: '—', descanso: '5 min', nota: 'Ritmo sostenible máximo. ANOTA EL TIEMPO. Antes: 3 min completos de descanso.', nuevo: true, iso: true, musculos: { primario: [], secundario: [] } },
      { agua: true, id: 'CSS-4', parte: 2, nombre: 'TEST 2 · 200 m a tope', series: 1, reps: '200 m', rir: '—', descanso: '—', nota: 'ANOTA EL TIEMPO. Con los dos tiempos ya tienes tu CSS.', nuevo: true, iso: true, musculos: { primario: [], secundario: [] } },
      { id: 'CSS-5', parte: 'finisher', nombre: 'Vuelta a la calma', series: 1, reps: '300 m', rir: '—', descanso: '—', nota: 'Muy suave.', musculos: { primario: [], secundario: [] } },
    ]
  },

  natacion: {
    nombre: 'Natación', subtitulo: 'Asignación flexible · impacto cero', color: '#06b6d4', duracion: '60 min',
    chequeo: 'No tiene posición fija en la secuencia: se asigna al primer día compatible con los horarios de la piscina, con prioridad L → N → P (N5). Nunca en día C (la piscina cierra antes de que salgas) ni en domingo. Puede ir junto a un día de pierna sin interferir (S6). Prioriza SIEMPRE las franjas de entrenamiento guiado: hay coach y el trabajo técnico vale mucho más. Si ninguna semana tiene día compatible, se convierte en running o gym y se registra el motivo.',
    ejercicios: [
      { id: 'NAT-1', parte: 1, nombre: 'Calentamiento', series: 1, reps: '8-10 min', rir: '—', descanso: '—', nota: 'Estilo libre suave + técnica.', musculos: { primario: [], secundario: [] } },
      { id: 'NAT-2', parte: 2, nombre: 'Bloque técnico', series: 4, reps: '50 m', rir: '—', descanso: '20s', nota: 'Drills: catch-up, patada lateral. Aprovecha al coach.', musculos: { primario: [], secundario: [] } },
      { id: 'NAT-3', parte: 2, nombre: 'Nado continuo Z2', series: 1, reps: '20-30 min', rir: '—', descanso: '—', nota: 'Ritmo conversacional.', musculos: { primario: [], secundario: [] } },
      { id: 'NAT-4', parte: 3, nombre: 'Vuelta a la calma', series: 1, reps: '5 min', rir: '—', descanso: '—', nota: 'Nado lento + flotación.', musculos: { primario: [], secundario: [] } },
    ]
  },

  ciclismo: {
    nombre: 'Bici Z2', subtitulo: 'Mismo Z2, cero impacto', color: '#0284c7', duracion: '40-55 min',
    chequeo: 'Misma zona que el running —60-70% FC máx, test de conversación— pero SIN impacto. Es la alternativa para el día flexible: llegas de 12h de pie en turno C y los pies, tibias y sóleo ya vienen castigados; correr encima carga los mismos tejidos. La bici te da el estímulo aeróbico sin ese coste, y de paso cubre el ciclismo que te falta para triatlón. Ojo: el impacto es cero, pero el cuádriceps SÍ trabaja — no la pongas el día después de pierna pesada.',
    ejercicios: [
      { id: 'BIC-1', parte: 1, nombre: 'Calentamiento', series: 1, reps: '8 min', rir: '—', descanso: '—', nota: 'Cadencia cómoda, resistencia baja. Subir pulsaciones poco a poco.', musculos: { primario: [], secundario: [] } },
      { id: 'BIC-2', parte: 2, nombre: 'Z2 continuo', series: 1, reps: '30-45 min', rir: '—', descanso: '—', nota: '60-70% FC máx. Cadencia 85-95 rpm. Si no puedes hablar, no es Z2 — baja resistencia antes que cadencia.', nuevo: true, musculos: { primario: [], secundario: [] } },
      { id: 'BIC-3', parte: 3, nombre: 'Vuelta a la calma', series: 1, reps: '5 min', rir: '—', descanso: '—', nota: 'Pedaleo suave, resistencia mínima.', musculos: { primario: [], secundario: [] } },
    ]
  },

  running: {
    nombre: 'Running Z2', subtitulo: 'Base aeróbica · 40-55 min', color: '#0891b2', duracion: '40-55 min',
    chequeo: 'NUNCA el día DESPUÉS de pierna (S3): si cae ahí, se cambia por natación. En día N siempre por la mañana o al mediodía (S5), nunca a las 5pm antes de la guardia. Z2 = test de conversación: si no puedes hablar, no es Z2.',
    ejercicios: [
      { id: 'RUN-1', parte: 1, nombre: 'Calentamiento', series: 1, reps: '8 min', rir: '—', descanso: '—', nota: 'Movilidad + caminar a trote.', musculos: { primario: [], secundario: [] } },
      { id: 'RUN-2', parte: 2, nombre: 'Z2 continuo', series: 1, reps: '30-45 min', rir: '—', descanso: '—', nota: '60-70% FC máx. Si no puedes hablar, no es Z2.', musculos: { primario: [], secundario: [] } },
      { id: 'RUN-3', parte: 3, nombre: 'Vuelta a la calma', series: 1, reps: '5 min', rir: '—', descanso: '—', nota: 'Trote suave a caminata.', musculos: { primario: [], secundario: [] } },
    ]
  },

  descanso: {
    nombre: 'Descanso', subtitulo: 'Recuperación', color: '#64748b', duracion: 'Día completo',
    chequeo: 'El sueño es tu factor limitante real. Si en posturno dormiste menos de 5h, este día es descanso completo (S4). La constancia y el superávit sostenido pesan más que cualquier detalle de la rutina.',
    ejercicios: []
  },
};

// Orden de presentación de las partes dentro de una sesión.
export const PARTES = {
  1: { label: 'Parte 1 · Series rectas', desc: 'Compuestos pesados · progresión lineal · descansos largos' },
  2: { label: 'Parte 2 · Compuesto secundario + aislamiento', desc: 'Bi-series entre ejercicios que no solapan (E8)' },
  3: { label: 'Parte 3 · Aislamientos', desc: 'Bi-series de aislamiento + aislamiento' },
  finisher: { label: 'Finisher', desc: 'Un solo acarreo por sesión (E9)' },
};
