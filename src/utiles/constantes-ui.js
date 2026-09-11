// Constantes que solo describen la INTERFAZ. Las del plan (sesiones, ejercicios,
// reglas) viven en data.js: aquí no se decide nada del entrenamiento.

// ─── Estado "día completado" (v6 · 7.1) ───
// INTENCIÓN DE DISEÑO: un día hecho DESTACA, no se atenúa. Esto es un rastreador
// de hábitos y el acumulado visible es parte de lo que empuja a seguir; apagar lo
// ya entrenado convertía el mes cumplido en la parte más gris de la pantalla.
//
// El tratamiento es un marco encendido del color de la PROPIA sesión: fondo de ese
// color al 14%, borde de 1.5px en los cuatro lados, y el borde superior pasa del
// color del turno al de la sesión. El ícono y la etiqueta se quedan en su tono vivo.
// Al derivarse del color de cada sesión desaparece el problema que tenía el lila
// fijo: ya no hay un color ajeno que compita con el morado de la calistenia.
// El turno no se pierde — la letra junto al número del día sigue con su color.
export const COMPLETADO = {
  alphaFondo: 0.14,
  borde: '1.5px',
  bordeSuperior: '3px',
  // El padding NO se compensa, y es deliberado: Chromium redondea los bordes
  // sub-píxel hacia abajo, así que ese 1.5px se usa como 1px en el cálculo de
  // layout — igual que el borde por defecto. Medido en densidades 1, 2 y 3.
  // Restarle medio píxel al padding "para compensar" encogía la celda 0.5px y
  // hacía bailar la cuadrícula al marcar un día.
  padding: '4px',
};

// Objeto vacío compartido: `algo || {}` crea uno nuevo en cada render y hace
// que los useMemo que dependen de él se recalculen siempre.
//
// OJO al partir componentes: tiene que seguir habiendo UNA sola instancia. Si
// cada archivo se declara su propio `{}`, la memoización deja de funcionar sin
// que ningún test lo note.
export const VACIO = {};

export const GYM_PIERNA_UI = ['gymC1', 'gymC2'];

export const NOMBRES_MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
