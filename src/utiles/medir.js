// Contador de renders para la puerta 6 (test-renders.mjs).
//
// Solo cuenta si el test ha creado `window.__renders` antes de cargar la app.
// En uso normal es un `if` que falla y nada más: cero coste, cero estado.
// Se llama al principio del cuerpo del componente, una vez por render.
export function contarRender(nombre) {
  const r = typeof window !== 'undefined' && window.__renders;
  if (r) r[nombre] = (r[nombre] || 0) + 1;
}
