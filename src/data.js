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
  P: { label: 'Posturno', color: '#64748b', bg: '#1a1f26', desc: 'Tras dormir · tarde' },
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
export const GYM_PIERNA = ['gymC1', 'gymC2', 'gymPA', 'gymPB'];
export const GYM_TORSO = ['gymA', 'gymB', 'gymD', 'gymTA', 'gymTB', 'gymE'];

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
  // v7 · Opción A: los dos torsos comparten pecho y espalda; las dos piernas, pierna.
  ['gymTA', 'gymTB'],
  ['gymPA', 'gymPB'],
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
  // D3 · semana 8 del bloque (descarga: mitad de series, RIR +2). Antes no se
  // doblaba nada, y eso dejaba 9 semanas al año sin cardio: 5 huecos para 6
  // sesiones y la única salida cerrada. Ahora se dobla solo con lo MÁS SUAVE:
  // la natación (pasa a segunda sesión y le cede su día al cardio) o la bici
  // (impacto cero). Running doblado en descarga, nunca. Medido: 0.81 → 0.90.
  descarga: { doblesSuaves: ['natacion', 'ciclismo'] },
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

// ─── v7.1 · El cupo de running es un cupo de CARDIO ───
// El requisito es cardio regular, 1 sesión/semana, no correr en concreto. La
// bici cuenta igual: si el usuario convierte el flexible a bici, esa semana ya
// tiene su cardio y el generador no busca otro hueco para el running. Y cuando
// el cardio no cabe en ningún día no-C, el flexible pasa a BICI POR DEFECTO
// (cero impacto tras las 12h; cubre el ciclismo del triatlón), con el running
// a un toque si ese día apetece correr. Sin esto el cardio se quedaba en 0.81
// semanal; con esto llega a 1.00.
export const CARDIO_CUPO = ['running', 'ciclismo'];
export const CARDIO_POR_DEFECTO_FLEXIBLE = 'ciclismo';

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

// ─── v7 · Bogotá · las dos rutinas de gym ───
// Opción A (por defecto): Torso / Pierna. La 5.ª (gymE) no está en la cola: es
// opcional y la elige el usuario en el día. Opción B: la cola de siempre.
export const SECUENCIA_TORSO_PIERNA = ['gymTA', 'gymPA', 'gymTB', 'gymPB'];
export const RUTINAS_GYM = {
  A: { label: 'Torso / Pierna', desc: '4 sesiones + 1 opcional de brazos y hombros', secuencia: SECUENCIA_TORSO_PIERNA, extra: ['gymE'] },
  B: { label: 'Empuje · Tracción · Pierna', desc: 'Tus cinco sesiones de siempre, con los ejercicios del plan de Bogotá', secuencia: SECUENCIA_GYM, extra: [] },
};

// Cardio de Bogotá: bici (o remo), alternando zona 2 y 4×4. Empieza por zona 2:
// las primeras semanas en la altura, mejor sin intervalos fuertes.
export const SECUENCIA_BICI = ['biciZ2', 'bici4x4'];

// ─── Los dos planes y desde cuándo rige cada uno ───
// El calendario no se reescribe hacia atrás: hasta el 29 de noviembre de 2026
// rige el plan v6 (Barranquilla); desde el lunes 30, el v7 (Bogotá).
//   cupo     → por semana; `running` es el cupo de CARDIO (nombre interno)
//   cardio   → qué sesión llena ese cupo
//   s3       → running/bici nunca el día después de pierna ni con pierna el mismo día
//   piscina  → horario de la piscina (franjas); null = sin horario fijo
//   descarga → semana 8 de cada bloque de descarga (P4)
export const PLAN_V6 = {
  version: 'v6', desde: '0000-01-01',
  cupo: { gym: 3, natacion: 2, running: 1, flexible: 1 },
  cardio: 'running', s3: true, piscina: true, descarga: true,
};
export const PLAN_BOGOTA = {
  version: 'v7', desde: '2026-11-30',
  cupo: { gym: 4, natacion: 0, running: 2, flexible: 1 },
  cardio: 'ciclismo', s3: false, piscina: false, descarga: false,
};
export const planDe = (fecha) => (fecha && fecha < PLAN_BOGOTA.desde ? PLAN_V6 : PLAN_BOGOTA);
// Las sesiones de gym que se ofrecen en los menús de un día: las del plan de esa
// fecha, y en Bogotá solo las de la rutina activa (más la 5.ª opcional).
export const gymOfrecido = (k, fecha, opcion = 'A') => {
  if (!String(k).startsWith('gym')) return true;
  const r = RUTINAS_GYM[opcion] ?? RUTINAS_GYM.A;
  const visibles = fecha && fecha < PLAN_BOGOTA.desde ? SECUENCIA_GYM : [...r.secuencia, ...r.extra];
  return visibles.includes(k);
};


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

// ─── Running · sesiones y rotación ───
// Dos bloques, como la natación. A es suave (base aeróbica, resistencia y un
// toque de velocidad corta que no cansa); B es la calidad (umbral y VO2máx).
// La clave del día sigue siendo 'running': solo cambia a qué variante resuelve.
export const RUNNING_SESIONES = ['runA1', 'runA2', 'runA3', 'runB1', 'runB2', 'runB3'];

// La rotación lleva las CUATRO indispensables (elegidas con Sebastián):
// Rodaje suave → Tempo → Fondo largo → Series 4×4. Con ~1 carrera por semana,
// cada una vuelve cada ~4 semanas en vez de cada 6, y se progresa antes en
// cada una. Fuera quedan Series de umbral (casi el mismo estímulo que el Tempo)
// y Cuestas (las aceleraciones y el gym de pierna ya lo cubren): siguen en
// Rutinas para un día suelto, y se pueden volver a meter en Ajustes.
// La mitad de las SESIONES son de calidad, pero por TIEMPO casi todo el running
// sigue siendo suave: calentar, recuperar y volver a la calma suman más minutos.
export const SECUENCIA_RUNNING = ['runA1', 'runB1', 'runA2', 'runB3'];

// El test de 30 min va primero y se repite cada ~12 carreras, colándose antes
// de un Tempo (mismo sistema energético). El Tempo no se pierde: va en la
// siguiente carrera, igual que el Umbral de natación tras el test de CSS.
export const RUNNING_TEST = {
  clave: 'runTest',
  sustituye: 'runB1',
  cadaCarreras: 12,
};

// Variantes válidas de cada sesión que resuelve a una variante. La clave del
// tipo ('running') vale como variante: es la sesión genérica de siempre, la que
// conservan los días registrados antes de que existieran las variantes.
export const VARIANTES_DE = {
  natacion: [...SECUENCIA_NATACION, 'natCSS'],
  running: [...RUNNING_SESIONES, RUNNING_TEST.clave],
  ciclismo: [...SECUENCIA_BICI],
};
// Clave real de lo que se entrena: natación y running resuelven a su variante;
// el resto es su propia clave. Una variante de otra familia no cuenta (puede
// quedar colgada si se cambió la segunda sesión a mano).
export const claveReal = (sesion, variante) =>
  (variante && VARIANTES_DE[sesion]?.includes(variante)) ? variante : sesion;
// A qué tipo pertenece una variante ('runB1' → 'running'); null si no es variante.
export const familiaDe = (k) => Object.keys(VARIANTES_DE).find(f => VARIANTES_DE[f].includes(k)) ?? null;
export const clavePrincipal = (d) => claveReal(d.sesion, d.variante);
export const claveSecundaria = (d) => (d.sesionSecundaria ? claveReal(d.sesionSecundaria, d.varianteSecundaria) : null);

// Zonas de running, en múltiplos de tu ritmo umbral (seg/km del test de 30 min).
// Ritmo más alto = más lento. Si no hay test, se va por sensaciones.
export const ZONAS_RUN = [
  { clave: 'Suave',   desde: 1.15, hasta: 1.30, habla: 'Frases completas sin esfuerzo', rpe: '3-4', uso: 'Rodajes, fondo largo, calentar y recuperar' },
  { clave: 'Tempo',   desde: 1.02, hasta: 1.06, habla: 'Frases cortas',                  rpe: '6-7', uso: 'Tempo continuo' },
  { clave: 'Umbral',  desde: 0.99, hasta: 1.01, habla: 'Frases cortas, ya cuesta',       rpe: '7',   uso: 'Series de umbral' },
  { clave: 'VO2máx',  desde: 0.90, hasta: 0.94, habla: 'Solo palabras sueltas',          rpe: '8-9', uso: 'Series 4×4' },
];

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
  // Los deportes que crea el usuario en Ajustes (config.js los registra)
  deporte:    { label: 'Tus deportes', icon: 'activity', color: '#f472b6' },
};

export const SESION_INFO = {
  // `label` es lo que se VE: el nombre de lo que se entrena. Las claves
  // (gymA, natB2…) son internas y NO se renombran: de ellas cuelga el
  // localStorage guardado.
  gymTA: { label: 'Torso A',   color: '#22c55e', icon: 'dumbbell', tipo: 'Pecho y espalda', grupo: 'gym' },
  gymPA: { label: 'Pierna A',  color: '#15803d', icon: 'dumbbell', tipo: 'Cuádriceps y fuerza', grupo: 'gym' },
  gymTB: { label: 'Torso B',   color: '#4ade80', icon: 'dumbbell', tipo: 'Hombro, pecho alto y espalda', grupo: 'gym' },
  gymPB: { label: 'Pierna B',  color: '#65a30d', icon: 'dumbbell', tipo: 'Glúteo y parte trasera', grupo: 'gym' },
  gymE:  { label: 'Brazos y hombros', color: '#16a34a', icon: 'dumbbell', tipo: '5.ª sesión opcional', grupo: 'gym' },
  gymC1: { label: 'Pierna fuerza',  color: '#15803d', icon: 'dumbbell', tipo: 'Sentadilla pesada · cero torso', grupo: 'gym' },
  gymC2: { label: 'Pierna volumen', color: '#65a30d', icon: 'dumbbell', tipo: 'Prensa · sin barra a la espalda', grupo: 'gym' },
  gymA:  { label: 'Empuje',     color: '#22c55e', icon: 'dumbbell', tipo: 'Pecho · hombro · tríceps', grupo: 'gym' },
  gymB:  { label: 'Tracción', color: '#16a34a', icon: 'dumbbell', tipo: 'Espalda · bíceps', grupo: 'gym' },
  gymD:  { label: 'Torso',       color: '#4ade80', icon: 'dumbbell', tipo: 'Empuje + tracción', grupo: 'gym' },
  calistenia: { label: 'Calistenia', color: '#a855f7', icon: 'home', tipo: 'Complemento · full body', grupo: 'calistenia' },
  natacion:   { label: 'Natación', color: '#06b6d4', icon: 'waves', tipo: 'Aeróbico', grupo: 'natacion' },
  natA1: { label: 'Técnica de crawl',    color: '#06b6d4', icon: 'waves', tipo: 'Bloque A · técnica', grupo: 'natacion' },
  natA2: { label: 'Espalda y pecho',    color: '#06b6d4', icon: 'waves', tipo: 'Bloque A · estilos', grupo: 'natacion' },
  natA3: { label: 'Estilos combinados',  color: '#06b6d4', icon: 'waves', tipo: 'Bloque A · estilos', grupo: 'natacion' },
  natB1: { label: 'Umbral',         color: '#0891b2', icon: 'waves', tipo: 'Bloque B · crawl', grupo: 'natacion' },
  natB2: { label: 'Aguas abiertas',  color: '#0891b2', icon: 'waves', tipo: 'Bloque B · continuo', grupo: 'natacion' },
  natB3: { label: 'Ritmo variable', color: '#0891b2', icon: 'waves', tipo: 'Bloque B · crawl', grupo: 'natacion' },
  natCSS: { label: 'Test CSS', color: '#0e7490', icon: 'waves', tipo: 'Test de umbral', grupo: 'natacion' },
  running:    { label: 'Running', color: '#0891b2', icon: 'run', tipo: 'Z2', grupo: 'cardio' },
  runA1:  { label: 'Rodaje suave', color: '#0891b2', icon: 'run', tipo: 'Bloque A · con aceleraciones', grupo: 'cardio' },
  runA2:  { label: 'Fondo largo',  color: '#0891b2', icon: 'run', tipo: 'Bloque A · resistencia', grupo: 'cardio' },
  runA3:  { label: 'Cuestas',      color: '#0891b2', icon: 'run', tipo: 'Bloque A · velocidad corta', grupo: 'cardio' },
  runB1:  { label: 'Tempo',        color: '#0369a1', icon: 'run', tipo: 'Bloque B · umbral continuo', grupo: 'cardio' },
  runB2:  { label: 'Series de umbral', color: '#0369a1', icon: 'run', tipo: 'Bloque B · umbral en bloques', grupo: 'cardio' },
  runB3:  { label: 'Series 4×4',   color: '#0369a1', icon: 'run', tipo: 'Bloque B · VO2máx', grupo: 'cardio' },
  runTest: { label: 'Test 30 min', color: '#075985', icon: 'run', tipo: 'Test de umbral', grupo: 'cardio' },
  ciclismo:  { label: 'Bici', color: '#0284c7', icon: 'bike', tipo: 'Z2 sin impacto', grupo: 'cardio' },
  bici4x4:   { label: 'Bici 4×4', color: '#0284c7', icon: 'bike', tipo: 'Intervalos · VO2máx', grupo: 'cardio' },
  biciZ2:    { label: 'Bici zona 2', color: '#0284c7', icon: 'bike', tipo: 'Suave · base aeróbica', grupo: 'cardio' },
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
  manguito:            { label: 'Manguito rotador', cat: 'traccion', color: '#16a34a' },
  // Tren inferior
  cuadriceps:          { label: 'Cuádriceps',      cat: 'pierna',  color: '#65a30d' },
  isquios:             { label: 'Isquios',         cat: 'pierna',  color: '#65a30d' },
  gluteo:              { label: 'Glúteo',          cat: 'pierna',  color: '#65a30d' },
  gluteo_medio:        { label: 'Glúteo medio',    cat: 'pierna',  color: '#65a30d' },
  aductores:           { label: 'Aductores',       cat: 'pierna',  color: '#65a30d' },
  tibial:              { label: 'Tibial',          cat: 'pierna',  color: '#65a30d' },
  gemelo:              { label: 'Gemelo',          cat: 'pierna',  color: '#65a30d' },
  soleo:               { label: 'Sóleo',           cat: 'pierna',  color: '#65a30d' },
  // Core
  core_antiextension:  { label: 'Core anti-ext.',  cat: 'core',    color: '#06b6d4' },
  core_antirotacion:   { label: 'Core anti-rot.',  cat: 'core',    color: '#06b6d4' },
  core_antilateral:    { label: 'Core anti-lat.',  cat: 'core',    color: '#06b6d4' },
  erectores:           { label: 'Erectores',       cat: 'core',    color: '#06b6d4' },
  cuello:              { label: 'Cuello',          cat: 'core',    color: '#06b6d4' },
};

export const CAT_MUSCULO = {
  empuje:   { label: 'Empuje',   color: '#22c55e' },
  traccion: { label: 'Tracción', color: '#16a34a' },
  pierna:   { label: 'Pierna',   color: '#65a30d' },
  core:     { label: 'Core',     color: '#06b6d4' },
};

// Franja productiva semanal por grupo (principiante). Fuera de [min,max] → aviso ámbar.
// v7: 10-14 por músculo y semana; 14-20 en las prioridades (pecho, espalda, hombro, brazos).
export const RANGO_VOLUMEN = { objetivoMin: 10, objetivoMax: 20, min: 6, max: 24 };

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
  // ═══════════════ PLAN v7 · BOGOTÁ (desde el 30 de noviembre de 2026) ═══════════════
  // Dos rutinas en la app y una activa. Por defecto, OPCIÓN A · Torso / Pierna:
  //   Torso A → Pierna A → Torso B → Pierna B, más una 5.ª opcional de brazos y hombros.
  // OPCIÓN B · las cinco de siempre (Empuje → Pierna fuerza → Torso → Pierna volumen →
  //   Tracción), con el contenido de la v7. Sus claves no cambian: gymA, gymC1, gymD,
  //   gymC2, gymB. Lo que se hizo con ellas hasta el 29 de noviembre está en planV6.js.
  //
  // Partes de la v7:
  //   0 · bloque atlético (saltos, lanzamientos, agilidad): fresco, explosivo
  //   1 · básicos: series rectas, 1-2 en reserva, 2-3 min, doble progresión (P1)
  //   2 y 3 · accesorios en bi-series (E8): última serie casi al fallo
  //   finisher · agarre y carga: un solo acarreo por sesión (E9)
  // Los aislamientos de brazo y hombro también van en días de pierna (E2 revisada):
  // los básicos son de una sola zona; los accesorios pequeños no cansan las piernas.

  // ─── OPCIÓN A · Torso / Pierna ───
  gymTA: {
    nombre: 'Torso A', subtitulo: 'Pecho y espalda', color: '#22c55e',
    duracion: '~94 min · 33 series',
    chequeo: 'La banca va primero: es tu test de pecho. 2 series de aproximación antes del primer básico (N1). Básicos con 1-2 repeticiones en reserva y 2-3 min de descanso; accesorios con la última serie casi al fallo. Doble progresión: primero llegas al tope de repeticiones en todas las series, después subes el peso (P1). Sin correas salvo que la mano falle antes que el músculo.',
    ejercicios: [
      { id: 'TA-1', parte: 1, nombre: 'Press de banca con barra', series: 3, reps: '5-8', rir: '1-2', progresion: '+2.5 kg', descanso: '3 min', nota: 'Primero del día: aquí se mide tu pecho. Escápulas atrás, bajada controlada, sin rebote.',
        musculos: { primario: ['pecho', 'triceps'], secundario: ['deltoides_anterior'] } },
      { id: 'TA-2', parte: 1, nombre: 'Dominada', series: 4, reps: '5-8', rir: '1-2', progresion: '+2.5 kg', descanso: '2-3 min', nota: 'Asistida (máquina o banda) si aún no haces 5 limpias. Con cinturón y disco cuando pases de 8 (E3). Sin correas: también es agarre.', lastre: true,
        musculos: { primario: ['dorsal', 'biceps'], secundario: ['espalda_media', 'braquial', 'antebrazo'] } },
      { id: 'TA-3', parte: 1, nombre: 'Press inclinado con mancuernas 30°', series: 3, reps: '8-12', rir: '1-2', progresion: '+2 kg', descanso: '2-3 min', nota: '30°, no más: si subes el banco, el trabajo se va al hombro.',
        musculos: { primario: ['pecho', 'deltoides_anterior'], secundario: ['triceps'] } },
      { id: 'TA-4', parte: 1, nombre: 'Remo con apoyo en pecho', series: 3, reps: '8-12', rir: '1-2', progresion: '+2.5 kg', descanso: '2 min', nota: 'Codos abiertos, a 45-60° del cuerpo: espalda media y hombro trasero. Máquina, o mancuernas boca abajo en banco inclinado.',
        musculos: { primario: ['espalda_media', 'deltoides_posterior'], secundario: ['dorsal', 'biceps', 'trapecio'] } },

      { id: 'TA-5', parte: 2, nombre: 'Elevación lateral en polea', series: 4, reps: '12-20', rir: '0-1', descanso: '60-90s', nota: 'Polea baja, a una mano, cable por detrás del cuerpo: el hombro trabaja estirado.', bs: 'BS1', bstipo: 'nc',
        musculos: { primario: ['deltoides_medio'], secundario: [] } },
      { id: 'TA-6', parte: 2, nombre: 'Face pull en polea', series: 4, reps: '15-20', rir: '0-1', descanso: '60-90s', nota: 'OBLIGATORIO (E6). Polea alta con cuerda: tira hacia la frente y termina con los brazos en «Y». Hombro trasero, trapecio inferior y manguito.', bs: 'BS1', bstipo: 'nc',
        musculos: { primario: ['deltoides_posterior', 'trapecio'], secundario: ['manguito', 'espalda_media'] } },
      { id: 'TA-7', parte: 2, nombre: 'Tríceps sobre la cabeza en polea', series: 3, reps: '10-15', rir: '0-1', descanso: '60-90s', nota: 'De espaldas a la polea, con cuerda. La cabeza larga crece más estirada.', bs: 'BS2', bstipo: 'ant',
        musculos: { primario: ['triceps'], secundario: [] } },
      { id: 'TA-8', parte: 2, nombre: 'Curl inclinado con mancuernas', series: 3, reps: '8-12', rir: '0-1', descanso: '60-90s', nota: 'Banco a 45-60°, brazos colgando por detrás del cuerpo: bíceps estirado.', bs: 'BS2', bstipo: 'ant',
        musculos: { primario: ['biceps'], secundario: ['braquial'] } },

      { id: 'TA-9', parte: 3, nombre: 'Aperturas en polea', series: 2, reps: '12-15', rir: '0-1', descanso: '60s', nota: 'Polea doble, cables a la altura del pecho. Abre hasta notar el estiramiento.', bs: 'BS3', bstipo: 'nc',
        musculos: { primario: ['pecho'], secundario: [] } },
      { id: 'TA-10', parte: 3, nombre: 'Cuello con banda', series: 2, reps: '15-20', rir: '1-2', descanso: '60s', nota: 'Hacia delante y hacia atrás, lento y sin tirones. Empieza muy suave.', bs: 'BS3', bstipo: 'nc',
        musculos: { primario: ['cuello'], secundario: [] } },

      { id: 'TA-11', parte: 'finisher', nombre: 'Suitcase carry con mancuerna', series: 3, reps: '30 m/lado', rir: '—', descanso: '90s', nota: 'Único acarreo del día (E9). Torso vertical y hombros nivelados: si te inclinas, pesa demasiado (P2). Sin correas.', acarreo: true,
        musculos: { primario: ['core_antilateral', 'antebrazo'], secundario: ['trapecio', 'erectores'] } },
      { id: 'TA-12', parte: 'finisher', nombre: 'Dead hang', series: 2, reps: 'máx', rir: '—', descanso: '90s', nota: 'Colgado de la barra, brazos estirados y hombros activos. Anota los segundos; pasados 60 s, con peso o a una mano.', iso: true,
        musculos: { primario: ['antebrazo'], secundario: ['dorsal'] } },
    ]
  },

  gymPA: {
    nombre: 'Pierna A', subtitulo: 'Cuádriceps y fuerza', color: '#15803d',
    duracion: '~95 min · 33 series',
    chequeo: 'Saltos y agilidad primero, frescos y con descanso completo: calidad, no cansancio. La pierna va antes que todo lo demás; los brazos, al final, no le quitan nada. Doble progresión en los básicos (P1). Si fallas las repeticiones dos sesiones seguidas, bajas el 10 % y vuelves a subir (P6). Entre dos días de pierna, al menos un día en medio (S7).',
    ejercicios: [
      { id: 'PA-1', parte: 0, nombre: 'Saltos al cajón', series: 3, reps: '3-5', rir: '—', descanso: '90s', nota: 'Sube de un salto y baja andando, no saltando. Calidad, no cansancio.',
        musculos: { primario: [], secundario: ['cuadriceps', 'gluteo', 'gemelo'] } },
      { id: 'PA-2', parte: 0, nombre: 'Agilidad con conos', series: 1, reps: '4 min', rir: '—', descanso: '—', nota: 'Ida y vuelta 5-10-5, escalera o cambios de dirección. Rápido y con buena técnica: para antes de que se vuelva lento.',
        musculos: { primario: [], secundario: ['cuadriceps', 'gemelo'] } },

      { id: 'PA-3', parte: 1, nombre: 'Sentadilla trasera con barra', series: 4, reps: '5-8', rir: '1-2', progresion: '+5 kg', descanso: '3 min', nota: 'Prioridad del día. Profundidad mínimo paralelo, espalda neutra.',
        musculos: { primario: ['cuadriceps', 'gluteo'], secundario: ['erectores', 'aductores'] } },
      { id: 'PA-4', parte: 1, nombre: 'Peso muerto rumano con barra', series: 3, reps: '6-10', rir: '1-2', progresion: '+5 kg', descanso: '2-3 min', nota: 'Cadera atrás, barra pegada al muslo, espalda neutra. Sin correas: también es agarre.',
        musculos: { primario: ['isquios', 'gluteo'], secundario: ['erectores', 'antebrazo', 'trapecio'] } },
      { id: 'PA-5', parte: 1, nombre: 'Prensa 45°', series: 3, reps: '10-15', rir: '1-2', progresion: '+5 kg', descanso: '2 min', nota: 'Recorrido completo sin despegar la espalda baja.',
        musculos: { primario: ['cuadriceps'], secundario: ['gluteo'] } },

      { id: 'PA-6', parte: 2, nombre: 'Extensión de cuádriceps', series: 3, reps: '12-20', rir: '0-1', descanso: '60-90s', nota: 'Respaldo reclinado: el recto femoral trabaja estirado. Opcional: 3-5 parciales abajo al final de la última serie.', bs: 'BS1', bstipo: 'ant',
        musculos: { primario: ['cuadriceps'], secundario: [] } },
      { id: 'PA-7', parte: 2, nombre: 'Curl femoral sentado', series: 3, reps: '8-12', rir: '0-1', descanso: '60-90s', nota: 'Sentado mejor que tumbado: el isquio trabaja más estirado.', bs: 'BS1', bstipo: 'ant',
        musculos: { primario: ['isquios'], secundario: [] } },
      { id: 'PA-8', parte: 2, nombre: 'Gemelo de pie en máquina', series: 5, reps: '8-12', rir: '0-1', descanso: '60s', nota: 'Pausa de 2 s abajo, con el gemelo estirado.', bs: 'BS2', bstipo: 'ant',
        musculos: { primario: ['gemelo'], secundario: [] } },
      { id: 'PA-9', parte: 2, nombre: 'Tibial contra la pared', series: 2, reps: '15-20', rir: '0-1', descanso: '60s', nota: 'De pie, espalda en la pared y talones adelante: sube las puntas. Para progresar, sentado con un disco sobre los pies.', bs: 'BS2', bstipo: 'ant',
        musculos: { primario: ['tibial'], secundario: [] } },

      { id: 'PA-10', parte: 3, nombre: 'Curl predicador con barra Z', series: 3, reps: '8-12', rir: '0-1', descanso: '60-90s', nota: 'Bíceps acortado. Baja controlado sin perder la tensión abajo.', bs: 'BS3', bstipo: 'ant',
        musculos: { primario: ['biceps'], secundario: ['braquial'] } },
      { id: 'PA-11', parte: 3, nombre: 'Tríceps en polea con barra', series: 3, reps: '10-15', rir: '0-1', descanso: '60-90s', nota: 'Polea alta, barra recta o en V. Codos pegados al cuerpo.', bs: 'BS3', bstipo: 'ant',
        musculos: { primario: ['triceps'], secundario: [] } },
      { id: 'PA-12', parte: 3, nombre: 'Pallof press en polea', series: 2, reps: '10-12/lado', rir: '1-2', descanso: '60s', nota: 'Empuja recto sin dejar que el torso gire ni un grado.',
        musculos: { primario: ['core_antirotacion'], secundario: [] } },

      { id: 'PA-13', parte: 'finisher', nombre: 'Carga frontal con saco de arena', series: 4, reps: '20-45s', rir: '—', descanso: '2-3 min', nota: 'Fuerza funcional. Levanta desde sentadilla, pega la carga al pecho y los codos contra las costillas. Al final de la sesión: ligera y con técnica perfecta. Protocolo en el plan (Anexo A).', iso: true,
        musculos: { primario: ['erectores', 'core_antiextension'], secundario: ['cuadriceps', 'gluteo', 'antebrazo', 'trapecio'] } },
      { id: 'PA-14', parte: 'finisher', nombre: 'Escaleras cargando', series: 1, reps: '1 tramo', rir: '—', descanso: '2 min', nota: 'Con la misma carga. Pasos cortos, pie completo, mirada al frente.',
        musculos: { primario: ['cuadriceps', 'gluteo'], secundario: ['erectores', 'core_antiextension'] } },
    ]
  },

  gymTB: {
    nombre: 'Torso B', subtitulo: 'Hombro, pecho alto y espalda', color: '#4ade80',
    duracion: '~95 min · 37 series',
    chequeo: 'El press inclinado va primero: tu pecho alto llega fresco. Dos remos distintos a propósito: el de Torso A abre los codos (espalda media), este los pega (dorsal). Doble progresión en los básicos (P1). El isométrico del curl martillo y la pinza son agarre: anota los segundos.',
    ejercicios: [
      { id: 'TB-1', parte: 0, nombre: 'Lanzamiento rotacional de balón', series: 3, reps: '5/lado', rir: '—', descanso: '60s', nota: 'Contra la pared, girando desde la cadera. Explosivo: es lo que transfiere a tenis, vóley o natación.',
        musculos: { primario: [], secundario: ['core_antirotacion'] } },

      { id: 'TB-2', parte: 1, nombre: 'Press inclinado con mancuernas 30°', series: 3, reps: '6-10', rir: '1-2', progresion: '+2 kg', descanso: '3 min', nota: 'Primero del día: tu pecho alto (punto débil #1) llega fresco.',
        musculos: { primario: ['pecho', 'deltoides_anterior'], secundario: ['triceps'] } },
      { id: 'TB-3', parte: 1, nombre: 'Jalón con agarre neutro', series: 3, reps: '8-12', rir: '1-2', progresion: '+2.5 kg', descanso: '2-3 min', nota: 'Agarre en V o neutro ancho. Baja las escápulas y luego tira. Sin correas.',
        musculos: { primario: ['dorsal'], secundario: ['biceps', 'espalda_media', 'braquial'] } },
      { id: 'TB-4', parte: 1, nombre: 'Press militar sentado con mancuernas', series: 4, reps: '6-10', rir: '1-2', progresion: '+2 kg', descanso: '2-3 min', nota: 'Banco a 90°. Hombro delantero y tríceps.',
        musculos: { primario: ['deltoides_anterior', 'triceps'], secundario: ['deltoides_medio'] } },
      { id: 'TB-5', parte: 1, nombre: 'Remo a una mano con mancuerna', series: 3, reps: '8-12', rir: '1-2', progresion: '+2 kg', descanso: '90s', nota: 'Apoyado en banco. Codo pegado al cuerpo y hacia la cadera: dorsal. Estira bien arriba.',
        musculos: { primario: ['dorsal'], secundario: ['espalda_media', 'biceps'] } },

      { id: 'TB-6', parte: 2, nombre: 'Elevación lateral con mancuernas', series: 4, reps: '15-25', rir: '0-1', descanso: '60-90s', nota: 'Hasta la altura del hombro, sin balanceo.', bs: 'BS1', bstipo: 'nc',
        musculos: { primario: ['deltoides_medio'], secundario: [] } },
      { id: 'TB-7', parte: 2, nombre: 'Pájaro en máquina', series: 4, reps: '15-20', rir: '0-1', descanso: '60-90s', nota: 'Hombro trasero. Brazos casi estirados; abre sin encoger los hombros.', bs: 'BS1', bstipo: 'nc',
        musculos: { primario: ['deltoides_posterior'], secundario: ['espalda_media'] } },
      { id: 'TB-8', parte: 2, nombre: 'Curl martillo con mancuernas', series: 3, reps: '10-15', rir: '0-1', descanso: '60-90s', nota: 'En la ÚLTIMA serie, al terminar quédate con los codos a 90° y aguanta hasta el fallo. Anota los segundos: es lo más parecido a sostener una carga en brazos.', iso: true, bs: 'BS2', bstipo: 'ant',
        musculos: { primario: ['braquial', 'biceps'], secundario: ['antebrazo'] } },
      { id: 'TB-9', parte: 2, nombre: 'Tríceps sobre la cabeza con mancuerna', series: 3, reps: '10-15', rir: '0-1', descanso: '60-90s', nota: 'Sentado, una mancuerna a dos manos. Baja detrás de la cabeza hasta notar el estiramiento.', bs: 'BS2', bstipo: 'ant',
        musculos: { primario: ['triceps'], secundario: [] } },

      { id: 'TB-10', parte: 3, nombre: 'Pullover en polea alta', series: 2, reps: '12-15', rir: '0-1', descanso: '60s', nota: 'Con cuerda o barra recta y los brazos casi estirados: dorsal sin bíceps.', bs: 'BS3', bstipo: 'ant',
        musculos: { primario: ['dorsal'], secundario: ['trapecio'] } },
      { id: 'TB-11', parte: 3, nombre: 'Aperturas en polea', series: 2, reps: '12-15', rir: '0-1', descanso: '60s', nota: 'Polea doble, cables de abajo hacia arriba: pecho alto.', bs: 'BS3', bstipo: 'ant',
        musculos: { primario: ['pecho'], secundario: [] } },
      { id: 'TB-12', parte: 3, nombre: 'Encogimientos con mancuernas', series: 3, reps: '10-15', rir: '0-1', descanso: '60s', nota: 'Sube recto hacia las orejas y pausa 1 s arriba. Sin correas.', bs: 'BS4', bstipo: 'nc',
        musculos: { primario: ['trapecio'], secundario: [] } },
      { id: 'TB-13', parte: 3, nombre: 'Pinza de discos', series: 2, reps: 'máx', rir: '—', descanso: '60s', nota: 'Dos discos lisos juntos, sujetos con los dedos estirados. Anota los segundos.', iso: true, bs: 'BS4', bstipo: 'nc',
        musculos: { primario: ['antebrazo'], secundario: [] } },

      { id: 'TB-14', parte: 'finisher', nombre: "Farmer's walk con mancuernas", series: 3, reps: '40 m', rir: '—', descanso: '90s', nota: 'Único acarreo del día (E9). Hombros atrás, pecho alto, pasos cortos. Sin correas.', acarreo: true,
        musculos: { primario: ['antebrazo', 'trapecio'], secundario: ['core_antilateral', 'erectores'] } },
    ]
  },

  gymPB: {
    nombre: 'Pierna B', subtitulo: 'Glúteo y parte trasera', color: '#65a30d',
    duracion: '~95 min · 41 series',
    chequeo: 'Sin barra a la espalda. El bear hug va pronto porque necesita la espalda fresca (E5), y es el único acarreo del día (E9): fuerza funcional. Saltos y sprints primero, con descanso completo. Los accesorios de hombro y antebrazo del final no cansan las piernas.',
    ejercicios: [
      { id: 'PB-1', parte: 0, nombre: 'Salto horizontal', series: 3, reps: '3', rir: '—', descanso: '90s', nota: 'Desde parado, cae amortiguando. Descanso completo.',
        musculos: { primario: [], secundario: ['gluteo', 'cuadriceps', 'isquios'] } },
      { id: 'PB-2', parte: 0, nombre: 'Sprints en bicicleta', series: 4, reps: '6-8 s', rir: '—', descanso: '60-90s', nota: 'A tope desde parado, con resistencia alta. Calidad, no cansancio.',
        musculos: { primario: [], secundario: ['cuadriceps', 'gluteo'] } },

      { id: 'PB-3', parte: 1, nombre: 'Complejo bear hug con saco de arena', series: 3, reps: '6 sent + 30-40 m', rir: '—', progresion: 'carga', descanso: '2 min', nota: 'Fuerza funcional. Carga abrazada al esternón: si baja del ombligo, para y recolócala. Va temprano: necesita la espalda fresca (E5).', acarreo: true,
        musculos: { primario: ['cuadriceps', 'erectores', 'gluteo'], secundario: ['core_antiextension', 'antebrazo'] } },
      { id: 'PB-4', parte: 1, nombre: 'Hip thrust con barra', series: 3, reps: '8-12', rir: '1-2', progresion: '+5 kg', descanso: '2 min', nota: 'Espalda en banco, almohadilla en la barra. Pausa 1 s arriba, costillas abajo.',
        musculos: { primario: ['gluteo'], secundario: ['isquios'] } },
      { id: 'PB-5', parte: 1, nombre: 'Peso muerto rumano con mancuernas', series: 3, reps: '8-12', rir: '1-2', progresion: '+2 kg', descanso: '2 min', nota: 'Mismo patrón que con barra, sin carga en la espalda. Sin correas.',
        musculos: { primario: ['isquios', 'gluteo'], secundario: ['erectores', 'antebrazo'] } },
      { id: 'PB-6', parte: 1, nombre: 'Búlgara con mancuernas', series: 3, reps: '8-10/pierna', rir: '1-2', progresion: '+2 kg', descanso: '90s', nota: 'Pie trasero en banco. Torso un poco inclinado hacia delante: más glúteo.',
        musculos: { primario: ['cuadriceps', 'gluteo'], secundario: ['aductores', 'gluteo_medio'] } },

      { id: 'PB-7', parte: 2, nombre: 'Curl femoral sentado', series: 3, reps: '8-12', rir: '0-1', descanso: '60-90s', nota: 'Sentado: el isquio trabaja más estirado.',
        musculos: { primario: ['isquios'], secundario: [] } },
      { id: 'PB-8', parte: 2, nombre: 'Gemelo sentado en máquina', series: 5, reps: '12-20', rir: '0-1', descanso: '60s', nota: 'Rodilla doblada: sóleo. Pausa abajo.', bs: 'BS1', bstipo: 'nc',
        musculos: { primario: ['soleo'], secundario: [] } },
      { id: 'PB-9', parte: 2, nombre: 'Rueda abdominal', series: 3, reps: '8-12', rir: '1-2', descanso: '60s', nota: 'Abdomen firme, sin hundir la espalda baja. Empieza de rodillas.', bs: 'BS1', bstipo: 'nc',
        musculos: { primario: ['core_antiextension'], secundario: [] } },

      { id: 'PB-10', parte: 3, nombre: 'Aductor en máquina', series: 2, reps: '12-15', rir: '0-1', descanso: '60s', nota: 'Recorrido amplio, abre hasta notar el estiramiento.', bs: 'BS2', bstipo: 'ant',
        musculos: { primario: ['aductores'], secundario: [] } },
      { id: 'PB-11', parte: 3, nombre: 'Abductor en máquina', series: 2, reps: '15-20', rir: '0-1', descanso: '60s', nota: 'Glúteo medio: estabiliza la rodilla.', bs: 'BS2', bstipo: 'ant',
        musculos: { primario: ['gluteo_medio'], secundario: [] } },
      { id: 'PB-12', parte: 3, nombre: 'Elevación lateral en polea', series: 3, reps: '12-20', rir: '0-1', descanso: '60s', nota: 'Polea baja, a una mano.', bs: 'BS3', bstipo: 'nc',
        musculos: { primario: ['deltoides_medio'], secundario: [] } },
      { id: 'PB-13', parte: 3, nombre: 'Pájaro en polea', series: 3, reps: '15-20', rir: '0-1', descanso: '60s', nota: 'Cables cruzados a la altura del hombro.', bs: 'BS3', bstipo: 'nc',
        musculos: { primario: ['deltoides_posterior'], secundario: [] } },
      { id: 'PB-14', parte: 3, nombre: 'Hiperextensión 45°', series: 2, reps: '12-15', rir: '1-2', descanso: '60s', nota: 'Espalda baja y glúteo. Para progresar, un disco abrazado al pecho.', bs: 'BS4', bstipo: 'nc',
        musculos: { primario: ['erectores', 'gluteo'], secundario: ['isquios'] } },
      { id: 'PB-15', parte: 3, nombre: 'Curl inverso con barra Z', series: 2, reps: '12-15', rir: '0-1', descanso: '60s', nota: 'Antebrazo y braquial. Muñecas firmes.', bs: 'BS4', bstipo: 'nc',
        musculos: { primario: ['braquial', 'antebrazo'], secundario: ['biceps'] } },
    ]
  },

  gymE: {
    nombre: 'Brazos y hombros', subtitulo: '5.ª sesión opcional', color: '#16a34a',
    duracion: '~65 min · 31 series',
    chequeo: 'Opcional: cuando quieras, sin condiciones. Las tres cabezas del hombro, bíceps, braquial, tríceps, antebrazo y manguito. No está en la rotación: la eliges tú en el día.',
    ejercicios: [
      { id: 'E-1', parte: 1, nombre: 'Press de hombro en máquina', series: 3, reps: '8-12', rir: '1-2', progresion: '+2.5 kg', descanso: '2 min', nota: 'Hombro delantero y tríceps, sin equilibrio que limite.',
        musculos: { primario: ['deltoides_anterior', 'triceps'], secundario: ['deltoides_medio'] } },
      { id: 'E-2', parte: 1, nombre: 'Jalón con palmas hacia ti', series: 3, reps: '6-10', rir: '1-2', progresion: '+2.5 kg', descanso: '2 min', nota: 'Barra recta, agarre al ancho de hombros: dorsal y bíceps.',
        musculos: { primario: ['dorsal', 'biceps'], secundario: ['braquial'] } },
      { id: 'E-3', parte: 1, nombre: 'Fondos en paralelas', series: 3, reps: '6-10', rir: '1-2', progresion: 'carga', descanso: '2 min', nota: 'Con cinturón y disco cuando hagas 10 limpias. Si molesta el hombro: press cerrado con barra.', lastre: true,
        musculos: { primario: ['triceps', 'pecho'], secundario: ['deltoides_anterior'] } },

      { id: 'E-4', parte: 2, nombre: 'Elevación lateral en polea', series: 4, reps: '12-20', rir: '0-1', descanso: '60s', nota: 'Polea baja, a una mano.', bs: 'BS1', bstipo: 'nc',
        musculos: { primario: ['deltoides_medio'], secundario: [] } },
      { id: 'E-5', parte: 2, nombre: 'Pájaro en máquina', series: 4, reps: '15-20', rir: '0-1', descanso: '60s', nota: 'Hombro trasero.', bs: 'BS1', bstipo: 'nc',
        musculos: { primario: ['deltoides_posterior'], secundario: [] } },
      { id: 'E-6', parte: 2, nombre: 'Curl en polea por detrás del cuerpo', series: 3, reps: '10-15', rir: '0-1', descanso: '60s', nota: 'Polea baja a una mano, de espaldas: bíceps estirado.', bs: 'BS2', bstipo: 'ant',
        musculos: { primario: ['biceps'], secundario: [] } },
      { id: 'E-7', parte: 2, nombre: 'Tríceps sobre la cabeza en polea', series: 3, reps: '10-15', rir: '0-1', descanso: '60s', nota: 'De espaldas a la polea, con cuerda.', bs: 'BS2', bstipo: 'ant',
        musculos: { primario: ['triceps'], secundario: [] } },

      { id: 'E-8', parte: 3, nombre: 'Curl martillo con cuerda en polea', series: 2, reps: '10-15', rir: '0-1', descanso: '60s', nota: 'En la última serie, isométrico a 90° hasta el fallo. Anota los segundos.', iso: true, bs: 'BS3', bstipo: 'ant',
        musculos: { primario: ['braquial', 'biceps'], secundario: ['antebrazo'] } },
      { id: 'E-9', parte: 3, nombre: 'Tríceps en polea con cuerda', series: 2, reps: '12-15', rir: '0-1', descanso: '60s', nota: 'Abre la cuerda abajo.', bs: 'BS3', bstipo: 'ant',
        musculos: { primario: ['triceps'], secundario: [] } },
      { id: 'E-10', parte: 3, nombre: 'Curl de muñeca con barra', series: 2, reps: '15-20', rir: '0-1', descanso: '45s', nota: 'Antebrazos apoyados en el banco, solo se mueve la muñeca.', bs: 'BS4', bstipo: 'nc',
        musculos: { primario: ['antebrazo'], secundario: [] } },
      { id: 'E-11', parte: 3, nombre: 'Rotación externa en polea', series: 2, reps: '15-20', rir: '1-2', descanso: '45s', nota: 'Polea a la altura del codo, codo pegado al cuerpo. Ligero: protege el hombro.', bs: 'BS4', bstipo: 'nc',
        musculos: { primario: ['manguito'], secundario: [] } },
      { id: 'E-12', parte: 3, nombre: 'Gemelo de pie en máquina', series: 2, reps: '8-12', rir: '0-1', descanso: '45s', nota: 'Pausa de 2 s abajo.', bs: 'BS5', bstipo: 'nc',
        musculos: { primario: ['gemelo'], secundario: [] } },
      { id: 'E-13', parte: 3, nombre: 'Elevación de piernas colgado', series: 2, reps: '8-12', rir: '1-2', descanso: '45s', nota: 'Sin balanceo: sube con el abdomen, no con impulso.', bs: 'BS5', bstipo: 'nc',
        musculos: { primario: ['core_antiextension'], secundario: [] } },
    ]
  },

  // ─── OPCIÓN B · las cinco de siempre, con el contenido de la v7 ───
  // Mismos ids que en la v6 para los ejercicios que siguen: su historial continúa.
  gymA: {
    nombre: 'Empuje', subtitulo: 'Pecho · hombro · tríceps · fuerza funcional', color: '#22c55e',
    duracion: '~90 min · 30 series',
    chequeo: 'La banca va primero. 2 series de aproximación antes del primer básico (N1). El face pull es obligatorio y no se recorta nunca (E6). Doble progresión en los básicos (P1); si fallas las repeticiones dos sesiones seguidas, bajas el 10 % (P6).',
    ejercicios: [
      { id: 'A-13', parte: 0, nombre: 'Lanzamiento de balón al pecho', series: 3, reps: '5', rir: '—', descanso: '60s', nota: 'Contra la pared, explosivo. Descanso completo.',
        musculos: { primario: [], secundario: ['pecho', 'triceps'] } },
      { id: 'A-1', parte: 1, nombre: 'Press de banca con barra', series: 3, reps: '5-8', rir: '1-2', progresion: '+2.5 kg', descanso: '3 min', nota: 'Prioridad #1. Escápulas atrás, bajada controlada, sin rebote.',
        musculos: { primario: ['pecho', 'triceps'], secundario: ['deltoides_anterior'] } },
      { id: 'A-3', parte: 1, nombre: 'Press inclinado con mancuernas 30°', series: 3, reps: '8-12', rir: '1-2', progresion: '+2 kg', descanso: '2-3 min', nota: '30°, no más: si subes el banco, el trabajo se va al hombro.',
        musculos: { primario: ['pecho', 'deltoides_anterior'], secundario: ['triceps'] } },
      { id: 'A-2', parte: 1, nombre: 'Press militar sentado con mancuernas', series: 4, reps: '6-10', rir: '1-2', progresion: '+2 kg', descanso: '2-3 min', nota: 'Banco a 90°. Hombro delantero y tríceps.',
        musculos: { primario: ['deltoides_anterior', 'triceps'], secundario: ['deltoides_medio'] } },
      { id: 'A-5', parte: 2, nombre: 'Aperturas en polea', series: 2, reps: '12-15', rir: '0-1', descanso: '60-90s', nota: 'Polea doble, cables a la altura del pecho.',
        musculos: { primario: ['pecho'], secundario: [] } },
      { id: 'A-6', parte: 2, nombre: 'Elevación lateral en polea', series: 4, reps: '12-20', rir: '0-1', descanso: '60-90s', nota: 'Polea baja, a una mano, cable por detrás del cuerpo.', bs: 'BS1', bstipo: 'nc',
        musculos: { primario: ['deltoides_medio'], secundario: [] } },
      { id: 'A-4', parte: 2, nombre: 'Face pull en polea', series: 4, reps: '15-20', rir: '0-1', descanso: '60-90s', nota: 'OBLIGATORIO (E6). Cuerda hacia la frente, terminando con los brazos en «Y».', bs: 'BS1', bstipo: 'nc',
        musculos: { primario: ['deltoides_posterior', 'trapecio'], secundario: ['manguito', 'espalda_media'] } },
      { id: 'A-7', parte: 3, nombre: 'Tríceps sobre la cabeza en polea', series: 3, reps: '10-15', rir: '0-1', descanso: '60s', nota: 'De espaldas a la polea, con cuerda: cabeza larga estirada.', bs: 'BS2', bstipo: 'nc',
        musculos: { primario: ['triceps'], secundario: [] } },
      { id: 'A-10', parte: 3, nombre: 'Pallof press en polea', series: 2, reps: '10-12/lado', rir: '1-2', descanso: '60s', nota: 'Empuja recto sin dejar que el torso gire.', bs: 'BS2', bstipo: 'nc',
        musculos: { primario: ['core_antirotacion'], secundario: [] } },
      { id: 'A-9', parte: 3, nombre: 'Tríceps en polea con cuerda', series: 3, reps: '12-15', rir: '0-1', descanso: '60s', nota: 'Abre la cuerda abajo.', bs: 'BS3', bstipo: 'nc',
        musculos: { primario: ['triceps'], secundario: [] } },
      { id: 'A-14', parte: 3, nombre: 'Cuello con banda', series: 2, reps: '15-20', rir: '1-2', descanso: '60s', nota: 'Hacia delante y hacia atrás, lento. Empieza muy suave.', bs: 'BS3', bstipo: 'nc',
        musculos: { primario: ['cuello'], secundario: [] } },
      { id: 'A-11', parte: 'finisher', nombre: 'Carga frontal con saco de arena', series: 4, reps: '20-45s', rir: '—', descanso: '2-3 min', nota: 'Fuerza funcional. Levanta desde sentadilla, pega la carga al pecho y los codos contra las costillas. Protocolo en el plan (Anexo A).', iso: true,
        musculos: { primario: ['erectores', 'core_antiextension'], secundario: ['cuadriceps', 'gluteo', 'antebrazo', 'trapecio'] } },
      { id: 'A-12', parte: 'finisher', nombre: 'Escaleras cargando', series: 1, reps: '1 tramo', rir: '—', descanso: '2 min', nota: 'Con la misma carga. Pasos cortos, pie completo.',
        musculos: { primario: ['cuadriceps', 'gluteo'], secundario: ['erectores', 'core_antiextension'] } },
    ]
  },

  gymC1: {
    nombre: 'Pierna fuerza', subtitulo: 'Cuádriceps y fuerza', color: '#15803d',
    duracion: '~90 min · 31 series',
    chequeo: 'Saltos y agilidad primero, frescos. La pierna va antes que todo; los brazos, al final. Doble progresión en los básicos (P1); si fallas las repeticiones dos sesiones seguidas, bajas el 10 % (P6). Entre dos días de pierna, al menos un día en medio (S7).',
    ejercicios: [
      { id: 'C1-11', parte: 0, nombre: 'Saltos al cajón', series: 3, reps: '3-5', rir: '—', descanso: '90s', nota: 'Sube de un salto y baja andando. Calidad, no cansancio.',
        musculos: { primario: [], secundario: ['cuadriceps', 'gluteo', 'gemelo'] } },
      { id: 'C1-12', parte: 0, nombre: 'Agilidad con conos', series: 1, reps: '4 min', rir: '—', descanso: '—', nota: 'Ida y vuelta 5-10-5 o escalera. Para antes de que se vuelva lento.',
        musculos: { primario: [], secundario: ['cuadriceps', 'gemelo'] } },
      { id: 'C1-1', parte: 1, nombre: 'Sentadilla trasera con barra', series: 4, reps: '5-8', rir: '1-2', progresion: '+5 kg', descanso: '3 min', nota: 'Prioridad del día. Profundidad mínimo paralelo.',
        musculos: { primario: ['cuadriceps', 'gluteo'], secundario: ['erectores', 'aductores'] } },
      { id: 'C1-3', parte: 1, nombre: 'Peso muerto rumano con barra', series: 3, reps: '6-10', rir: '1-2', progresion: '+5 kg', descanso: '2-3 min', nota: 'Cadera atrás, barra pegada al muslo. Sin correas.',
        musculos: { primario: ['isquios', 'gluteo'], secundario: ['erectores', 'antebrazo', 'trapecio'] } },
      { id: 'C1-4', parte: 1, nombre: 'Prensa 45°', series: 3, reps: '10-15', rir: '1-2', progresion: '+5 kg', descanso: '2 min', nota: 'Recorrido completo sin despegar la espalda baja.',
        musculos: { primario: ['cuadriceps'], secundario: ['gluteo'] } },
      { id: 'C1-6', parte: 2, nombre: 'Extensión de cuádriceps', series: 3, reps: '12-20', rir: '0-1', descanso: '60-90s', nota: 'Respaldo reclinado: recto femoral estirado.', bs: 'BS1', bstipo: 'ant',
        musculos: { primario: ['cuadriceps'], secundario: [] } },
      { id: 'C1-7', parte: 2, nombre: 'Curl femoral sentado', series: 3, reps: '8-12', rir: '0-1', descanso: '60-90s', nota: 'Sentado mejor que tumbado.', bs: 'BS1', bstipo: 'ant',
        musculos: { primario: ['isquios'], secundario: [] } },
      { id: 'C1-9', parte: 2, nombre: 'Gemelo de pie en máquina', series: 5, reps: '8-12', rir: '0-1', descanso: '60s', nota: 'Pausa de 2 s abajo.', bs: 'BS2', bstipo: 'ant',
        musculos: { primario: ['gemelo'], secundario: [] } },
      { id: 'C1-13', parte: 2, nombre: 'Tibial contra la pared', series: 2, reps: '15-20', rir: '0-1', descanso: '60s', nota: 'Espalda en la pared, sube las puntas. Para progresar, disco sobre los pies.', bs: 'BS2', bstipo: 'ant',
        musculos: { primario: ['tibial'], secundario: [] } },
      { id: 'C1-14', parte: 3, nombre: 'Curl predicador con barra Z', series: 3, reps: '8-12', rir: '0-1', descanso: '60-90s', nota: 'Bíceps acortado. Baja controlado.', bs: 'BS3', bstipo: 'ant',
        musculos: { primario: ['biceps'], secundario: ['braquial'] } },
      { id: 'C1-15', parte: 3, nombre: 'Tríceps en polea con barra', series: 3, reps: '10-15', rir: '0-1', descanso: '60-90s', nota: 'Codos pegados al cuerpo.', bs: 'BS3', bstipo: 'ant',
        musculos: { primario: ['triceps'], secundario: [] } },
      { id: 'C1-16', parte: 3, nombre: 'Rueda abdominal', series: 2, reps: '8-12', rir: '1-2', descanso: '60s', nota: 'Sin hundir la espalda baja. Empieza de rodillas.',
        musculos: { primario: ['core_antiextension'], secundario: [] } },
    ]
  },

  gymD: {
    nombre: 'Torso', subtitulo: 'Pecho alto · espalda · hombro · brazos', color: '#4ade80',
    duracion: '~92 min · 33 series',
    chequeo: 'El press inclinado va primero. Empuje y tracción juntos a propósito: tus dos puntos débiles reciben su segunda dosis. El farmer\'s walk es el único acarreo (E9) y va al final por el agarre (E5).',
    ejercicios: [
      { id: 'D-3', parte: 1, nombre: 'Press inclinado con mancuernas 30°', series: 3, reps: '6-10', rir: '1-2', progresion: '+2 kg', descanso: '3 min', nota: 'Primero del día: pecho alto fresco.',
        musculos: { primario: ['pecho', 'deltoides_anterior'], secundario: ['triceps'] } },
      { id: 'D-2', parte: 1, nombre: 'Dominada', series: 3, reps: '6-10', rir: '1-2', progresion: '+2.5 kg', descanso: '2-3 min', nota: 'Asistida si aún no haces 6 limpias; con cinturón y disco al pasar de 8 (E3). Sin correas.', lastre: true,
        musculos: { primario: ['dorsal', 'biceps'], secundario: ['espalda_media', 'braquial', 'antebrazo'] } },
      { id: 'D-4', parte: 1, nombre: 'Remo con apoyo en pecho', series: 3, reps: '8-12', rir: '1-2', progresion: '+2.5 kg', descanso: '2 min', nota: 'Codos abiertos: espalda media y hombro trasero.',
        musculos: { primario: ['espalda_media', 'deltoides_posterior'], secundario: ['dorsal', 'biceps', 'trapecio'] } },
      { id: 'D-10', parte: 1, nombre: 'Press de pecho en máquina', series: 2, reps: '8-12', rir: '1-2', progresion: '+2.5 kg', descanso: '2 min', nota: 'Segunda dosis de pecho sin equilibrio que limite.',
        musculos: { primario: ['pecho', 'triceps'], secundario: ['deltoides_anterior'] } },
      { id: 'D-5', parte: 2, nombre: 'Elevación lateral con mancuernas', series: 4, reps: '15-25', rir: '0-1', descanso: '60-90s', nota: 'Hasta la altura del hombro, sin balanceo.', bs: 'BS1', bstipo: 'nc',
        musculos: { primario: ['deltoides_medio'], secundario: [] } },
      { id: 'D-7', parte: 2, nombre: 'Pájaro en máquina', series: 4, reps: '15-20', rir: '0-1', descanso: '60-90s', nota: 'Hombro trasero.', bs: 'BS1', bstipo: 'nc',
        musculos: { primario: ['deltoides_posterior'], secundario: ['espalda_media'] } },
      { id: 'D-11', parte: 2, nombre: 'Curl martillo con mancuernas', series: 3, reps: '10-15', rir: '0-1', descanso: '60-90s', nota: 'En la última serie, isométrico a 90° hasta el fallo. Anota los segundos.', iso: true, bs: 'BS2', bstipo: 'ant',
        musculos: { primario: ['braquial', 'biceps'], secundario: ['antebrazo'] } },
      { id: 'D-8', parte: 2, nombre: 'Tríceps sobre la cabeza con mancuerna', series: 3, reps: '10-15', rir: '0-1', descanso: '60-90s', nota: 'Sentado, una mancuerna a dos manos.', bs: 'BS2', bstipo: 'ant',
        musculos: { primario: ['triceps'], secundario: [] } },
      { id: 'D-12', parte: 3, nombre: 'Aperturas en polea', series: 2, reps: '12-15', rir: '0-1', descanso: '60s', nota: 'Cables de abajo hacia arriba: pecho alto.', bs: 'BS3', bstipo: 'nc',
        musculos: { primario: ['pecho'], secundario: [] } },
      { id: 'D-13', parte: 3, nombre: 'Encogimientos con mancuernas', series: 3, reps: '10-15', rir: '0-1', descanso: '60s', nota: 'Pausa 1 s arriba. Sin correas.', bs: 'BS3', bstipo: 'nc',
        musculos: { primario: ['trapecio'], secundario: [] } },
      { id: 'D-14', parte: 3, nombre: 'Pinza de discos', series: 2, reps: 'máx', rir: '—', descanso: '60s', nota: 'Dos discos lisos juntos con los dedos estirados. Anota los segundos.', iso: true,
        musculos: { primario: ['antebrazo'], secundario: [] } },
      { id: 'D-9', parte: 'finisher', nombre: "Farmer's walk con mancuernas", series: 3, reps: '40 m', rir: '—', descanso: '90s', nota: 'Único acarreo del día (E9). Hombros atrás, pecho alto, pasos cortos (P2).', acarreo: true,
        musculos: { primario: ['antebrazo', 'trapecio'], secundario: ['core_antilateral', 'erectores'] } },
    ]
  },

  gymC2: {
    nombre: 'Pierna volumen', subtitulo: 'Glúteo y parte trasera · sin barra a la espalda', color: '#65a30d',
    duracion: '~95 min · 39 series',
    chequeo: 'Sin barra a la espalda. El bear hug va pronto (E5) y es el único acarreo (E9): fuerza funcional. Saltos y sprints primero, con descanso completo.',
    ejercicios: [
      { id: 'C2-11', parte: 0, nombre: 'Salto horizontal', series: 3, reps: '3', rir: '—', descanso: '90s', nota: 'Desde parado, cae amortiguando.',
        musculos: { primario: [], secundario: ['gluteo', 'cuadriceps', 'isquios'] } },
      { id: 'C2-12', parte: 0, nombre: 'Sprints en bicicleta', series: 4, reps: '6-8 s', rir: '—', descanso: '60-90s', nota: 'A tope desde parado, resistencia alta.',
        musculos: { primario: [], secundario: ['cuadriceps', 'gluteo'] } },
      { id: 'C2-1', parte: 1, nombre: 'Prensa 45°', series: 3, reps: '10-15', rir: '1-2', progresion: '+5 kg', descanso: '2 min', nota: 'Motor del día. Recorrido completo sin despegar la espalda baja.',
        musculos: { primario: ['cuadriceps'], secundario: ['gluteo', 'isquios'] } },
      { id: 'C2-2', parte: 1, nombre: 'Complejo bear hug con saco de arena', series: 3, reps: '6 sent + 30-40 m', rir: '—', progresion: 'carga', descanso: '2 min', nota: 'Fuerza funcional. Carga abrazada al esternón: si baja del ombligo, recolócala.', acarreo: true,
        musculos: { primario: ['cuadriceps', 'erectores', 'gluteo'], secundario: ['core_antiextension', 'antebrazo'] } },
      { id: 'C2-10', parte: 1, nombre: 'Hip thrust con barra', series: 3, reps: '8-12', rir: '1-2', progresion: '+5 kg', descanso: '2 min', nota: 'Pausa 1 s arriba, costillas abajo.',
        musculos: { primario: ['gluteo'], secundario: ['isquios'] } },
      { id: 'C2-3', parte: 1, nombre: 'Peso muerto rumano con mancuernas', series: 3, reps: '8-12', rir: '1-2', progresion: '+2 kg', descanso: '2 min', nota: 'Sin carga en la espalda. Sin correas.',
        musculos: { primario: ['isquios', 'gluteo'], secundario: ['erectores', 'antebrazo'] } },
      { id: 'C2-4', parte: 1, nombre: 'Búlgara con mancuernas', series: 3, reps: '8-10/pierna', rir: '1-2', progresion: '+2 kg', descanso: '90s', nota: 'Pie trasero en banco, torso un poco inclinado.',
        musculos: { primario: ['cuadriceps', 'gluteo'], secundario: ['aductores', 'gluteo_medio'] } },
      { id: 'C2-6', parte: 2, nombre: 'Curl femoral sentado', series: 2, reps: '8-12', rir: '0-1', descanso: '60-90s', nota: 'Sentado: isquio estirado.',
        musculos: { primario: ['isquios'], secundario: [] } },
      { id: 'C2-5', parte: 2, nombre: 'Gemelo sentado en máquina', series: 5, reps: '12-20', rir: '0-1', descanso: '60s', nota: 'Rodilla doblada: sóleo. Pausa abajo.', bs: 'BS1', bstipo: 'nc',
        musculos: { primario: ['soleo'], secundario: [] } },
      { id: 'C2-13', parte: 2, nombre: 'Rueda abdominal', series: 3, reps: '8-12', rir: '1-2', descanso: '60s', nota: 'Sin hundir la espalda baja.', bs: 'BS1', bstipo: 'nc',
        musculos: { primario: ['core_antiextension'], secundario: [] } },
      { id: 'C2-14', parte: 3, nombre: 'Aductor en máquina', series: 2, reps: '12-15', rir: '0-1', descanso: '60s', nota: 'Recorrido amplio.', bs: 'BS2', bstipo: 'ant',
        musculos: { primario: ['aductores'], secundario: [] } },
      { id: 'C2-15', parte: 3, nombre: 'Abductor en máquina', series: 2, reps: '15-20', rir: '0-1', descanso: '60s', nota: 'Glúteo medio.', bs: 'BS2', bstipo: 'ant',
        musculos: { primario: ['gluteo_medio'], secundario: [] } },
      { id: 'C2-16', parte: 3, nombre: 'Elevación lateral en polea', series: 3, reps: '12-20', rir: '0-1', descanso: '60s', nota: 'Polea baja, a una mano.', bs: 'BS3', bstipo: 'nc',
        musculos: { primario: ['deltoides_medio'], secundario: [] } },
      { id: 'C2-17', parte: 3, nombre: 'Pájaro en polea', series: 3, reps: '15-20', rir: '0-1', descanso: '60s', nota: 'Cables cruzados a la altura del hombro.', bs: 'BS3', bstipo: 'nc',
        musculos: { primario: ['deltoides_posterior'], secundario: [] } },
      { id: 'C2-8', parte: 3, nombre: 'Hiperextensión 45°', series: 2, reps: '12-15', rir: '1-2', descanso: '60s', nota: 'Espalda baja y glúteo.', bs: 'BS4', bstipo: 'nc',
        musculos: { primario: ['erectores', 'gluteo'], secundario: ['isquios'] } },
      { id: 'C2-18', parte: 3, nombre: 'Curl inverso con barra Z', series: 2, reps: '12-15', rir: '0-1', descanso: '60s', nota: 'Antebrazo y braquial.', bs: 'BS4', bstipo: 'nc',
        musculos: { primario: ['braquial', 'antebrazo'], secundario: ['biceps'] } },
    ]
  },

  gymB: {
    nombre: 'Tracción', subtitulo: 'Espalda · bíceps · braquial · agarre', color: '#16a34a',
    duracion: '~88 min · 33 series',
    chequeo: 'Dominada primero: punto débil #2. Al llegar a 8 a peso corporal, con lastre (E3). Sin correas: la espalda también entrena el agarre. El suitcase es el único acarreo (E9) y va al final (E5).',
    ejercicios: [
      { id: 'B-12', parte: 0, nombre: 'Lanzamiento rotacional de balón', series: 3, reps: '5/lado', rir: '—', descanso: '60s', nota: 'Contra la pared, girando desde la cadera.',
        musculos: { primario: [], secundario: ['core_antirotacion'] } },
      { id: 'B-1', parte: 1, nombre: 'Dominada', series: 4, reps: '5-8', rir: '1-2', progresion: '+2.5 kg', descanso: '3 min', nota: 'Prioridad #2. Nunca al fallo. Sin correas.', lastre: true,
        musculos: { primario: ['dorsal', 'biceps'], secundario: ['espalda_media', 'braquial', 'antebrazo'] } },
      { id: 'B-13', parte: 1, nombre: 'Remo a una mano con mancuerna', series: 3, reps: '8-12', rir: '1-2', progresion: '+2 kg', descanso: '90s', nota: 'Codo pegado al cuerpo y hacia la cadera: dorsal.',
        musculos: { primario: ['dorsal'], secundario: ['espalda_media', 'biceps'] } },
      { id: 'B-3', parte: 1, nombre: 'Jalón con agarre neutro', series: 3, reps: '10-15', rir: '1-2', progresion: '+2.5 kg', descanso: '2 min', nota: 'Escápulas abajo, luego tira.',
        musculos: { primario: ['dorsal'], secundario: ['biceps', 'espalda_media'] } },
      { id: 'B-5', parte: 2, nombre: 'Pullover en polea alta', series: 2, reps: '12-15', rir: '0-1', descanso: '60s', nota: 'Dorsal sin que el bíceps intervenga.',
        musculos: { primario: ['dorsal'], secundario: ['trapecio'] } },
      { id: 'B-7', parte: 2, nombre: 'Pájaro en máquina', series: 3, reps: '15-20', rir: '0-1', descanso: '60s', nota: 'Hombro trasero.', bs: 'BS1', bstipo: 'nc',
        musculos: { primario: ['deltoides_posterior'], secundario: [] } },
      { id: 'B-6', parte: 2, nombre: 'Curl inclinado con mancuernas', series: 3, reps: '8-12', rir: '0-1', descanso: '60s', nota: 'Bíceps estirado.', bs: 'BS1', bstipo: 'nc',
        musculos: { primario: ['biceps'], secundario: ['braquial'] } },
      { id: 'B-14', parte: 2, nombre: 'Face pull en polea', series: 3, reps: '15-20', rir: '0-1', descanso: '60s', nota: 'OBLIGATORIO (E6). Cuerda hacia la frente, terminando en «Y».', bs: 'BS2', bstipo: 'nc',
        musculos: { primario: ['deltoides_posterior', 'trapecio'], secundario: ['manguito'] } },
      { id: 'B-8', parte: 2, nombre: 'Curl martillo con mancuernas', series: 3, reps: '10-15', rir: '0-1', descanso: '60s', nota: 'En la última serie, isométrico a 90° hasta el fallo. Anota los segundos.', iso: true, bs: 'BS2', bstipo: 'nc',
        musculos: { primario: ['braquial', 'biceps'], secundario: ['antebrazo'] } },
      { id: 'B-15', parte: 3, nombre: 'Curl inverso con barra Z', series: 2, reps: '12-15', rir: '0-1', descanso: '45s', nota: 'Antebrazo y braquial.', bs: 'BS3', bstipo: 'nc',
        musculos: { primario: ['braquial', 'antebrazo'], secundario: ['biceps'] } },
      { id: 'B-16', parte: 3, nombre: 'Rotación externa en polea', series: 2, reps: '15-20', rir: '1-2', descanso: '45s', nota: 'Ligero: protege el hombro.', bs: 'BS3', bstipo: 'nc',
        musculos: { primario: ['manguito'], secundario: [] } },
      { id: 'B-10', parte: 'finisher', nombre: 'Suitcase carry con mancuerna', series: 3, reps: '30 m/lado', rir: '—', descanso: '90s', nota: 'Único acarreo del día (E9). Torso vertical (P2).', acarreo: true,
        musculos: { primario: ['core_antilateral', 'antebrazo'], secundario: ['trapecio', 'erectores'] } },
      { id: 'B-11', parte: 'finisher', nombre: 'Dead hang', series: 2, reps: 'máx', rir: '—', descanso: '90s', nota: 'Brazos estirados, hombros activos. Anota los segundos.', iso: true,
        musculos: { primario: ['antebrazo'], secundario: ['dorsal'] } },
    ]
  },

  // ─── Cardio v7 · bici (o remo) ───
  // El cupo de cardio de Bogotá: 2 por semana, alternando 4×4 y zona 2.
  bici4x4: {
    nombre: 'Bici 4×4', subtitulo: '~40 min · 4 × 4 min fuerte', color: '#0284c7', duracion: '40 min',
    chequeo: 'La sesión que más sube el VO2máx: 4 bloques de 4 min al 85-95 % de tu frecuencia máxima con 3 min suaves entre medias (protocolo de Helgerud). En bici o en remo. En los bloques solo puedes decir palabras sueltas. Las primeras semanas en Bogotá, por la altura, empieza por el 85 %.',
    ejercicios: [
      { id: 'BX-1', parte: 1, nombre: 'Calentamiento', series: 1, reps: '10 min', rir: '—', descanso: '—', nota: 'Suave, subiendo poco a poco. Termina con 2 aceleraciones de 15 s.', musculos: { primario: [], secundario: [] } },
      { id: 'BX-2', parte: 2, nombre: 'Bloques fuertes', series: 4, reps: '4 min', rir: '—', descanso: '3 min suave', nota: 'Esfuerzo 8-9 de 10. Los primeros 60-90 s se sienten fáciles: no aceleres de más.', musculos: { primario: [], secundario: [] } },
      { id: 'BX-3', parte: 'finisher', nombre: 'Vuelta a la calma', series: 1, reps: '5 min', rir: '—', descanso: '—', nota: 'Pedaleo suave, resistencia mínima.', musculos: { primario: [], secundario: [] } },
    ]
  },
  biciZ2: {
    nombre: 'Bici zona 2', subtitulo: '30-45 min · suave', color: '#0284c7', duracion: '40-55 min',
    chequeo: 'Base aeróbica sin cansar las piernas para el gym. Puedes hablar en frases completas: esfuerzo 3-4 de 10. En bici, remo o elíptica. Cuando tengas piscina o un parque, la natación o la carrera también valen.',
    ejercicios: [
      { id: 'BZ-1', parte: 1, nombre: 'Calentamiento', series: 1, reps: '5 min', rir: '—', descanso: '—', nota: 'Cadencia cómoda, resistencia baja.', musculos: { primario: [], secundario: [] } },
      { id: 'BZ-2', parte: 2, nombre: 'Zona 2 continua', series: 1, reps: '30-45 min', rir: '—', descanso: '—', nota: 'Frases completas sin esfuerzo. Si no puedes hablar, baja la resistencia.', musculos: { primario: [], secundario: [] } },
      { id: 'BZ-3', parte: 'finisher', nombre: 'Vuelta a la calma', series: 1, reps: '5 min', rir: '—', descanso: '—', nota: 'Pedaleo suave.', musculos: { primario: [], secundario: [] } },
    ]
  },

  calistenia: {
    nombre: 'Calistenia', subtitulo: 'Complemento apilable · no ocupa día propio', color: '#a855f7',
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
    nombre: 'Técnica de crawl', subtitulo: '2.000 m · ~52 min', color: '#06b6d4', duracion: '60 min',
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
    nombre: 'Espalda y pecho', subtitulo: '2.300 m · ~55 min', color: '#06b6d4', duracion: '60 min',
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
    nombre: 'Estilos combinados', subtitulo: '2.000 m · ~50 min', color: '#06b6d4', duracion: '60 min',
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
    nombre: 'Umbral', subtitulo: '2.100 m · ~55 min · La más importante para triatlón', color: '#0891b2', duracion: '60 min',
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
    nombre: 'Aguas abiertas', subtitulo: '2.400 m · ~58 min', color: '#0891b2', duracion: '60 min',
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
    nombre: 'Ritmo variable', subtitulo: '2.200 m · ~55 min', color: '#0891b2', duracion: '60 min',
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
    nombre: 'Test CSS', subtitulo: 'Hazlo en tu primera sesión', color: '#0e7490', duracion: '60 min',
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
    nombre: 'Bici', subtitulo: 'Mismo Z2, cero impacto', color: '#0284c7', duracion: '40-55 min',
    chequeo: 'Misma zona que el running —60-70% FC máx, test de conversación— pero SIN impacto. Es la alternativa para el día flexible: llegas de 12h de pie en turno C y los pies, tibias y sóleo ya vienen castigados; correr encima carga los mismos tejidos. La bici te da el estímulo aeróbico sin ese coste, y de paso cubre el ciclismo que te falta para triatlón. Ojo: el impacto es cero, pero el cuádriceps SÍ trabaja — no la pongas el día después de pierna pesada.',
    ejercicios: [
      { id: 'BIC-1', parte: 1, nombre: 'Calentamiento', series: 1, reps: '8 min', rir: '—', descanso: '—', nota: 'Cadencia cómoda, resistencia baja. Subir pulsaciones poco a poco.', musculos: { primario: [], secundario: [] } },
      { id: 'BIC-2', parte: 2, nombre: 'Z2 continuo', series: 1, reps: '30-45 min', rir: '—', descanso: '—', nota: '60-70% FC máx. Cadencia 85-95 rpm. Si no puedes hablar, no es Z2 — baja resistencia antes que cadencia.', nuevo: true, musculos: { primario: [], secundario: [] } },
      { id: 'BIC-3', parte: 3, nombre: 'Vuelta a la calma', series: 1, reps: '5 min', rir: '—', descanso: '—', nota: 'Pedaleo suave, resistencia mínima.', musculos: { primario: [], secundario: [] } },
    ]
  },

  running: {
    nombre: 'Running', subtitulo: 'Base aeróbica · 40-55 min', color: '#0891b2', duracion: '40-55 min',
    chequeo: 'NUNCA el día DESPUÉS de pierna (S3): si cae ahí, se cambia por natación. En día N siempre por la mañana o al mediodía (S5), nunca a las 5pm antes de la guardia. Z2 = test de conversación: si no puedes hablar, no es Z2.',
    ejercicios: [
      { id: 'RUN-1', parte: 1, nombre: 'Calentamiento', series: 1, reps: '8 min', rir: '—', descanso: '—', nota: 'Movilidad + caminar a trote.', musculos: { primario: [], secundario: [] } },
      { id: 'RUN-2', parte: 2, nombre: 'Z2 continuo', series: 1, reps: '30-45 min', rir: '—', descanso: '—', nota: '60-70% FC máx. Si no puedes hablar, no es Z2.', musculos: { primario: [], secundario: [] } },
      { id: 'RUN-3', parte: 3, nombre: 'Vuelta a la calma', series: 1, reps: '5 min', rir: '—', descanso: '—', nota: 'Trote suave a caminata.', musculos: { primario: [], secundario: [] } },
    ]
  },

  // ═══ RUNNING · BLOQUE A — suave (base aeróbica, resistencia y velocidad corta) ═══
  // Intensidad sin reloj: test del habla y esfuerzo percibido (RPE 1-10). Con
  // el test de 30 min hecho, la tabla de ritmos da además el ritmo por km.
  runA1: {
    nombre: 'Rodaje suave', subtitulo: '40-50 min · suave + 6 aceleraciones', color: '#0891b2', duracion: '40-50 min',
    chequeo: 'La base de todo: así de suave debería ir la mayor parte de tu running. Tienes que poder hablar en frases completas; si no puedes, baja el ritmo aunque te parezca lentísimo. Las aceleraciones NO son sprints: son 20 s rápidos y sueltos para trabajar la técnica y la velocidad sin cansarte. Nunca el día después de pierna (S3).',
    recortada: 'Rodaje 30 → 20 min · aceleraciones 6 → 4 (30 min)',
    ejercicios: [
      { id: 'RA1-1', parte: 1, nombre: 'Calentamiento', series: 1, reps: '10 min', rir: '—', descanso: '—', nota: '3 min caminando rápido y 7 min de trote muy suave. Antes de arrancar: balanceos de pierna y skipping suave.', musculos: { primario: [], secundario: [] } },
      { id: 'RA1-2', parte: 2, nombre: 'Rodaje suave', series: 1, reps: '25-30 min', rir: '—', descanso: '—', nota: 'Ritmo Suave. Hablas en frases completas, esfuerzo 3-4 de 10.', musculos: { primario: [], secundario: [] } },
      { id: 'RA1-3', parte: 2, nombre: 'Aceleraciones', series: 6, reps: '20 s', rir: '—', descanso: '60-90 s caminando', nota: 'Rápido pero relajado, esfuerzo 7-8 de 10. Pasos cortos y rápidos, pie debajo de la cadera, brazos sueltos. Si te tensas, vas demasiado fuerte.', nuevo: true, musculos: { primario: [], secundario: [] } },
      { id: 'RA1-4', parte: 'finisher', nombre: 'Vuelta a la calma', series: 1, reps: '5 min', rir: '—', descanso: '—', nota: 'Trote muy suave hasta caminar.', musculos: { primario: [], secundario: [] } },
    ]
  },

  runA2: {
    nombre: 'Fondo largo', subtitulo: '50-70 min · todo suave', color: '#0891b2', duracion: '50-70 min',
    chequeo: 'La sesión que construye la resistencia: más tiempo, no más rápido. Todo en Suave, test del habla. Progresión: 5 min más cada vez que te toque, hasta 70 min. Sube poco a poco: los saltos grandes de volumen (más de un 30 % de una semana a otra) se han asociado con más lesiones por sobrecarga en corredores principiantes. Si es posturno o dormiste menos de 6 h, haz la recortada.',
    recortada: 'Fondo 45 → 30 min (40 min en total)',
    ejercicios: [
      { id: 'RA2-1', parte: 1, nombre: 'Calentamiento', series: 1, reps: '5-10 min', rir: '—', descanso: '—', nota: 'Caminar rápido y trote muy suave.', musculos: { primario: [], secundario: [] } },
      { id: 'RA2-2', parte: 2, nombre: 'Fondo continuo', series: 1, reps: '45-60 min', rir: '—', descanso: '—', nota: 'Ritmo Suave todo el rato. Si a mitad ya no puedes hablar, baja: lo que cuenta es el tiempo. Lleva agua si pasa de 60 min.', nuevo: true, musculos: { primario: [], secundario: [] } },
      { id: 'RA2-3', parte: 'finisher', nombre: 'Vuelta a la calma', series: 1, reps: '5 min', rir: '—', descanso: '—', nota: 'Caminar.', musculos: { primario: [], secundario: [] } },
    ]
  },

  runA3: {
    nombre: 'Cuestas', subtitulo: '40-45 min · suave + 8 subidas cortas', color: '#0891b2', duracion: '40-45 min',
    chequeo: 'Velocidad y fuerza en la zancada con poco desgaste: subidas MUY cortas, fuertes, y bajada caminando hasta recuperar del todo. La pendiente frena la velocidad y reduce el impacto, por eso es la forma más segura de correr rápido. Sin cuesta cerca: un puente, una rampa o escaleras; si no hay nada, haz 8 aceleraciones de 15 s en llano.',
    recortada: 'Rodaje 20 → 15 min · subidas 8 → 6 (30 min)',
    ejercicios: [
      { id: 'RA3-1', parte: 1, nombre: 'Calentamiento', series: 1, reps: '10 min', rir: '—', descanso: '—', nota: 'Trote muy suave. Termina con 2 aceleraciones de 15 s en llano.', musculos: { primario: [], secundario: [] } },
      { id: 'RA3-2', parte: 2, nombre: 'Rodaje suave', series: 1, reps: '15-20 min', rir: '—', descanso: '—', nota: 'Ritmo Suave, hasta llegar a la cuesta.', musculos: { primario: [], secundario: [] } },
      { id: 'RA3-3', parte: 2, nombre: 'Subidas cortas', series: 8, reps: '10-12 s', rir: '—', descanso: '2 min bajando a pie', nota: 'Fuerte, esfuerzo 9 de 10, pero con buena técnica: rodillas arriba, brazos activos, mirada al frente. Recuperación COMPLETA: si la siguiente sale más lenta, para.', nuevo: true, musculos: { primario: [], secundario: [] } },
      { id: 'RA3-4', parte: 'finisher', nombre: 'Vuelta a la calma', series: 1, reps: '5-10 min', rir: '—', descanso: '—', nota: 'Trote muy suave hasta caminar.', musculos: { primario: [], secundario: [] } },
    ]
  },

  // ═══ RUNNING · BLOQUE B — calidad (umbral y VO2máx) ═══
  runB1: {
    nombre: 'Tempo', subtitulo: '45-50 min · 20 min cómodamente duro', color: '#0369a1', duracion: '45-50 min',
    chequeo: 'Sube tu umbral: el ritmo más rápido que aguantas mucho rato. "Cómodamente duro": hablas en frases cortas, esfuerzo 6-7 de 10. Ve PAREJO: si el final sale más lento que el principio, empezaste demasiado rápido. Progresión: 20 → 25 → 30 min. Nunca el día después de pierna (S3).',
    recortada: 'Tempo 20 → 15 min · calentamiento 15 → 10 (35 min)',
    ejercicios: [
      { id: 'RB1-1', parte: 1, nombre: 'Calentamiento', series: 1, reps: '15 min', rir: '—', descanso: '—', nota: 'Trote suave. Termina con 3 aceleraciones de 15 s.', musculos: { primario: [], secundario: [] } },
      { id: 'RB1-2', parte: 2, nombre: 'Tempo continuo', series: 1, reps: '20 min', rir: '—', descanso: '—', nota: 'Ritmo Tempo. Frases cortas, esfuerzo 6-7. Si tienes reloj, anota el ritmo medio: es tu métrica de progreso.', nuevo: true, musculos: { primario: [], secundario: [] } },
      { id: 'RB1-3', parte: 'finisher', nombre: 'Vuelta a la calma', series: 1, reps: '10 min', rir: '—', descanso: '—', nota: 'Trote muy suave.', musculos: { primario: [], secundario: [] } },
    ]
  },

  runB2: {
    nombre: 'Series de umbral', subtitulo: '50 min · 4 × 6 min', color: '#0369a1', duracion: '50 min',
    chequeo: 'El mismo estímulo que el Tempo, partido en bloques con un minuto de trote: haces más minutos de calidad con menos fatiga. Todas las series al mismo ritmo; la última debe salir igual que la primera. Progresión: 4 × 6 → 5 × 6 → 3 × 10 min.',
    recortada: '4 series → 3 · calentamiento 15 → 10 (38 min)',
    ejercicios: [
      { id: 'RB2-1', parte: 1, nombre: 'Calentamiento', series: 1, reps: '15 min', rir: '—', descanso: '—', nota: 'Trote suave. Termina con 3 aceleraciones de 15 s.', musculos: { primario: [], secundario: [] } },
      { id: 'RB2-2', parte: 2, nombre: 'Series de umbral', series: 4, reps: '6 min', rir: '—', descanso: '1 min trotando', nota: 'Ritmo Umbral, esfuerzo 7 de 10. Frases cortas y ya cuesta. Iguales de principio a fin.', nuevo: true, musculos: { primario: [], secundario: [] } },
      { id: 'RB2-3', parte: 'finisher', nombre: 'Vuelta a la calma', series: 1, reps: '8-10 min', rir: '—', descanso: '—', nota: 'Trote muy suave.', musculos: { primario: [], secundario: [] } },
    ]
  },

  runB3: {
    nombre: 'Series 4×4', subtitulo: '45 min · 4 × 4 min fuerte', color: '#0369a1', duracion: '45 min',
    chequeo: 'La sesión que más sube el VO2máx: 4 series de 4 min al 90-95 % de tu frecuencia máxima con 3 min de trote suave entre medias (protocolo 4×4 de Helgerud). Es la más dura del plan: solo con buen sueño. Si es posturno o dormiste menos de 6 h, cámbiala por un Rodaje suave. Progresión: primero que las 4 salgan parejas; luego, un poco más rápido.',
    recortada: '4 series → 3 (38 min)',
    ejercicios: [
      { id: 'RB3-1', parte: 1, nombre: 'Calentamiento', series: 1, reps: '12 min', rir: '—', descanso: '—', nota: 'Trote suave. Termina con 3 aceleraciones de 15 s.', musculos: { primario: [], secundario: [] } },
      { id: 'RB3-2', parte: 2, nombre: 'Series fuertes', series: 4, reps: '4 min', rir: '—', descanso: '3 min trote suave', nota: 'Ritmo VO2máx, esfuerzo 8-9 de 10. Solo puedes decir palabras sueltas. Los primeros 60-90 s se sienten fáciles: no aceleres de más.', nuevo: true, musculos: { primario: [], secundario: [] } },
      { id: 'RB3-3', parte: 'finisher', nombre: 'Vuelta a la calma', series: 1, reps: '8-10 min', rir: '—', descanso: '—', nota: 'Trote muy suave hasta caminar.', musculos: { primario: [], secundario: [] } },
    ]
  },

  runTest: {
    nombre: 'Test 30 min', subtitulo: 'Da tu ritmo umbral y tus zonas', color: '#075985', duracion: '55 min',
    chequeo: 'Corre 30 min lo más rápido que puedas mantener PAREJO, en llano y con GPS. Apunta la distancia: la app saca tu ritmo umbral (30 min ÷ km) y de ahí todas tus zonas. Es una prueba de campo, no de laboratorio: da una buena aproximación, no un número exacto. Si llevas más de un mes sin correr, haz antes 2-3 Rodajes suaves. Se repite cada ~12 carreras, antes de un Tempo.',
    ejercicios: [
      { id: 'RT-1', parte: 1, nombre: 'Calentamiento', series: 1, reps: '15 min', rir: '—', descanso: '—', nota: 'Trote suave. Termina con 3 aceleraciones de 15 s y 2 min caminando.', musculos: { primario: [], secundario: [] } },
      { id: 'RT-2', parte: 2, nombre: 'TEST · 30 min', series: 1, reps: '30 min', rir: '—', descanso: '—', nota: 'Esfuerzo máximo SOSTENIBLE: los primeros 5 min deben sentirse controlados. ANOTA LA DISTANCIA al terminar.', nuevo: true, musculos: { primario: [], secundario: [] } },
      { id: 'RT-3', parte: 'finisher', nombre: 'Vuelta a la calma', series: 1, reps: '10 min', rir: '—', descanso: '—', nota: 'Trote muy suave hasta caminar.', musculos: { primario: [], secundario: [] } },
    ]
  },

  descanso: {
    nombre: 'Descanso', subtitulo: 'Recuperación', color: '#64748b', duracion: 'Día completo',
    chequeo: 'El sueño es tu factor limitante real. La constancia y el superávit sostenido pesan más que cualquier detalle de la rutina.',
    ejercicios: []
  },
};

// Orden de presentación de las partes dentro de una sesión.
export const PARTES = {
  0: { label: 'Bloque atlético', desc: 'Saltos, lanzamientos y agilidad · fresco y explosivo · descanso completo' },
  1: { label: 'Parte 1 · Básicos', desc: 'Series rectas · 1-2 en reserva · 2-3 min de descanso' },
  2: { label: 'Parte 2 · Accesorios', desc: 'Bi-series entre ejercicios que no solapan (E8)' },
  3: { label: 'Parte 3 · Aislamientos', desc: 'Bi-series de aislamiento + aislamiento' },
  finisher: { label: 'Agarre y carga', desc: 'Un solo acarreo por sesión (E9)' },
};

// ─── E11 · Deshacer una bi-serie sobre la marcha (v7.1) ───
// Una bi-serie (E8) da por hecho que las dos estaciones están libres. En un
// gimnasio lleno muchas veces no lo están. E11: ese día se pueden hacer los dos
// ejercicios POR SEPARADO, en series rectas, sin que la sesión cuente como
// incompleta ni se pierda el registro. Es una decisión del momento, no una
// edición de la rutina: al día siguiente la bi-serie vuelve a estar como
// estaba. Se guarda en el progreso del día, bajo la clave `__bsSueltas`, como
// lista de bi-series (['BS1', 'BS3']) — el prefijo `__` la deja fuera del
// recuento de ejercicios registrados, igual que `__sueno`.
export const E11 = {
  regla: 'E11',
  clave: '__bsSueltas',
  label: 'Hoy por separado',
  texto: 'Las dos estaciones no siempre están libres. Hoy haces los dos ejercicios en series rectas, con su descanso normal; la bi-serie sigue igual mañana.',
};
