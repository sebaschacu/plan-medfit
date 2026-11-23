// ═══════════════ PLAN v6 · SESIONES DE GYM (Barranquilla) ═══════════════
//
// Copia CONGELADA de las cinco sesiones de gym tal como eran hasta el
// 29 de noviembre de 2026. Desde el 30 (semana del intercambio en Bogotá)
// rige el plan v7 de data.js. Se conservan para que el pasado no se reescriba:
// un día de agosto sigue mostrando los ejercicios que se hicieron ese día, con
// sus ids, y su registro no queda huérfano (rutina.js → planBase).
// No se edita: si cambia el plan, cambia data.js.

export const SESIONES_V6 = {
  gymA: {
    nombre: 'Empuje', subtitulo: 'Pecho · hombro · tríceps · carga real', color: '#22c55e',
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
    nombre: 'Pierna fuerza', subtitulo: 'Pierna pesada · CERO torso', color: '#15803d',
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
    nombre: 'Torso', subtitulo: 'Empuje + tracción · equilibrio', color: '#4ade80',
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
    nombre: 'Pierna volumen', subtitulo: 'Pierna volumen · sin barra a la espalda', color: '#65a30d',
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
    nombre: 'Tracción', subtitulo: 'Espalda · bíceps · braquial', color: '#16a34a',
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
  }
};
