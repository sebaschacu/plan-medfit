// ═══════════════ PERSISTENCIA ═══════════════
// Todo lo que toca localStorage o ficheros. Sin React: funciones puras o con
// efectos explícitos, para que App solo tenga que orquestar setState y avisos.
//
// La clave y la forma v3 del snapshot son CONTRATO: cualquier cambio rompe el
// localStorage de la app ya instalada. test-snapshot.mjs lo vigila.

import { FESTIVOS_DEFAULT } from '../generador.js';
import { normalizarConfig } from '../config.js';

export const CLAVE = 'plan-internado';

// ─── Carga del estado guardado ───
// Se lee UNA vez y de forma síncrona, para usarla en inicializadores lazy de
// useState. Antes esto vivía en un useEffect con seis setState: la app pintaba
// el estado por defecto, luego saltaba al guardado, y en StrictMode el effect
// corría dos veces. Leyéndolo aquí, el primer render ya es el bueno.
//
// OJO: el singleton `_guardado` tiene que existir UNA sola vez. Si este módulo
// se duplicara o se copiara la función a otro archivo, cada copia leería
// localStorage por su cuenta y los useState podrían arrancar desincronizados.
let _guardado;
export function estadoGuardado() {
  if (_guardado) return _guardado;
  _guardado = { ancla: null, fijados: {}, extras: {}, css: null, rutina: {}, festivos: null, prog: {}, prs: {} };
  try {
    const raw = localStorage.getItem(CLAVE);
    if (!raw) return _guardado;
    const d = JSON.parse(raw);
    if (d.v === 3) {
      _guardado = {
        ancla: d.ancla ?? null,
        fijados: d.fijados ?? {},
        extras: d.extras ?? {},
        css: d.css ?? null,
        rutina: d.rutina ?? {},
        festivos: Array.isArray(d.festivos) ? d.festivos : null,
        prog: d.prog ?? {},
        prs: d.prs ?? {},
        config: normalizarConfig(d.config),
      };
      return _guardado;
    }
    // ── MIGRACIÓN v2 → v3 ──
    // En la v2 el progreso se indexaba por NÚMERO DE DÍA (1..31) y el calendario
    // era siempre agosto 2026. Con multi-mes ese número es ambiguo, así que las
    // claves se reindexan a fecha ISO asumiendo agosto 2026, que es lo que eran.
    const prog = {};
    for (const [k, v] of Object.entries(d.prog ?? {})) {
      const n = Number(k);
      prog[Number.isInteger(n) && n >= 1 && n <= 31
        ? `2026-08-${String(n).padStart(2, '0')}`
        : k] = v;
    }
    // El calendario v2 escrito a mano se DESCARTA: lo sustituye el generador.
    // Los festivos que hubiera marcado sí se conservan, y van al ARRAY `festivos`,
    // que es de donde los lee el generador.
    const fest = Array.isArray(d.cal)
      ? d.cal.filter(x => x.festivo && x.dia).map(x => `2026-08-${String(x.dia).padStart(2, '0')}`)
      : [];
    _guardado = {
      ancla: null,
      fijados: {},
      festivos: fest.length ? [...new Set([...FESTIVOS_DEFAULT, ...fest])] : null,
      prog,
      prs: d.prs ?? {},
    };
  } catch { /* localStorage bloqueado o JSON corrupto: se arranca de cero */ }
  return _guardado;
}

// ─── Guardar ───
// Devuelve false si el navegador lo bloquea (cuota llena, modo privado).
export function guardar(datos) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(datos));
    return true;
  } catch {
    return false;
  }
}

// ─── Exportar ───
// Descarga el snapshot como fichero JSON. Lanza si el navegador no lo permite;
// quien llama decide qué avisar.
export function descargarJSON(datos, nombre) {
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── Importar ───
// Lee un fichero de respaldo y lo normaliza a la forma v3. Resuelve siempre:
// { ok: true, datos } o { ok: false, error } con el texto para el usuario.
//
// Se restaura TODO lo que exporta snapshot(). Si aquí falta un campo, importar
// un respaldo lo borra en silencio en el dispositivo destino.
export function leerRespaldo(file) {
  return new Promise((resolve) => {
    const lector = new FileReader();
    lector.onload = () => {
      try {
        const d = JSON.parse(String(lector.result));
        // Validación mínima: debe parecer un respaldo de esta app, no un JSON cualquiera.
        if (!d || typeof d !== 'object' || (!d.prog && !d.fijados && !d.ancla)) {
          resolve({ ok: false, error: 'Ese archivo no parece un respaldo de la app.' });
          return;
        }
        const obj = x => (x && typeof x === 'object' && !Array.isArray(x) ? x : null);
        resolve({
          ok: true,
          datos: {
            ancla: d.ancla || null,
            fijados: obj(d.fijados) ?? {},
            festivos: Array.isArray(d.festivos) ? d.festivos : FESTIVOS_DEFAULT,
            extras: obj(d.extras) ?? {},
            css: typeof d.css === 'number' && d.css > 0 ? d.css : null,   // seg/100 m
            rutina: obj(d.rutina) ?? {},
            prog: obj(d.prog) ?? {},
            prs: obj(d.prs) ?? {},
            // Ajustes del plan. Un respaldo de antes de existir no la trae: se
            // importa vacía, que es «el plan tal cual».
            config: normalizarConfig(d.config),
          },
        });
      } catch {
        resolve({ ok: false, error: 'El archivo está corrupto o no es JSON válido.' });
      }
    };
    lector.onerror = () => resolve({ ok: false, error: 'No se pudo leer el archivo.' });
    lector.readAsText(file);
  });
}
