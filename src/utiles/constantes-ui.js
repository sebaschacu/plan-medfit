// Constantes que solo describen la INTERFAZ. Las del plan (sesiones, ejercicios,
// reglas) viven en data.js: aquí no se decide nada del entrenamiento.

// Objeto vacío compartido: `algo || {}` crea uno nuevo en cada render y hace
// que los useMemo que dependen de él se recalculen siempre.
//
// OJO al partir componentes: tiene que seguir habiendo UNA sola instancia. Si
// cada archivo se declara su propio `{}`, la memoización deja de funcionar sin
// que ningún test lo note.
export const VACIO = {};

export const GYM_PIERNA_UI = ['gymC1', 'gymC2'];

// ─── Ancho máximo en escritorio (v7.1 · 2.5) ───
// La app es de móvil. En pantalla ancha se estiraba sin límite: el contenido
// ya iba centrado, pero las cabeceras no, y sus botones acababan uno en cada
// extremo del monitor. Una sola columna de 768 px, igual para cabecera y
// contenido, en todas las pantallas. En móvil no cambia nada.
//
// Tailwind rastrea este archivo (content: src/**), así que la clase literal
// aquí basta para que se genere.
export const COLUMNA = 'max-w-3xl mx-auto';

export const NOMBRES_MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
