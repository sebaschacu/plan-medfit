/** @type {import('tailwindcss').Config} */
// Sistema visual de la dirección D. Los colores de SESIÓN y de TURNO no van
// aquí: viven en data.js (SESION_INFO, TURNO_INFO) y se aplican por estilo,
// porque su significado es del plan, no de la interfaz.
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        fondo: '#0d1215',     // la pantalla
        tarjeta: '#141a1f',   // tarjetas
        elevada: '#1b2228',   // lo que va encima de una tarjeta
        divisor: '#1f272e',   // líneas entre filas
        fila: '#1c242a',      // borde de fila
        borde: '#2a343c',     // contorno de controles
        tinta: '#e8edf0',     // texto principal
        tinta2: '#b2bdc5',    // texto secundario
        tinta3: '#8a97a1',    // texto terciario y rótulos
        mudo: '#7d8a95',      // texto apagado (pasa 4.5:1 sobre fondo)
        tenue: '#56636d',     // SOLO adornos, nunca texto
        ambar: '#f5b54a',     // avisos, racha, lastre
      },
      fontFamily: {
        sans: ['Geist', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
