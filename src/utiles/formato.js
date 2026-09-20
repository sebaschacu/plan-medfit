// Conversiones de formato: color, tiempo y fecha. Funciones puras, sin estado.

import { NOMBRES_MES } from './constantes-ui.js';

// #22c55e → rgba(34, 197, 94, alpha). Los colores viven en SESION_INFO; derivarlos
// aquí evita duplicar la paleta en cada celda.
export const hexARgba = (hex, alpha) => {
  const h = String(hex || '').replace('#', '');
  const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const v = parseInt(n, 16);
  if (n.length !== 6 || Number.isNaN(v)) return `rgba(148, 163, 184, ${alpha})`;
  return `rgba(${(v >> 16) & 255}, ${(v >> 8) & 255}, ${v & 255}, ${alpha})`;
};

// "3 min" → 180 · "45s" → 45 · "2-3 min" → 180 (el tope) · "—" o "0s" → null.
// OJO: antes descartaba con `s.includes('0s')`, que además de "0s" se llevaba
// "60s", "90s", "30s", "20s" y "40s": 38 ejercicios sin temporizador nunca.
export const parseRest = (s) => {
  if (!s || s === '—' || /^\s*0\s*s?\s*$/.test(s)) return null;
  const n = parseFloat(s.replace(',', '.'));
  if (isNaN(n)) return null;
  const range = s.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
  const v = range ? parseFloat(range[2]) : n;
  return s.toLowerCase().includes('min') ? Math.round(v * 60) : Math.round(v);
};

export const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

// Gancho para las pruebas: si existe `plan-internado-hoy` en localStorage, esa
// es la fecha de hoy. Se lee UNA vez al cargar el módulo, igual que el estado
// guardado: la app entera ve el mismo "hoy" durante toda la sesión.
//
// Para un usuario real es inerte: nadie tiene esa clave salvo que la ponga a
// mano. Existe porque la app pinta la sesión de HOY antes de que un test pueda
// navegar a ningún sitio, y sin fijar la fecha la suite de UI cambiaba de
// resultado según la semana en que se ejecutara (ver BASELINE.md).
let _hoyFijado;
try { _hoyFijado = localStorage.getItem('plan-internado-hoy') || null; } catch { _hoyFijado = null; }

// Fecha local de hoy en ISO (no UTC: si no, de noche en Colombia saltaría al día siguiente).
export const hoyISO = () => {
  if (_hoyFijado) return _hoyFijado;
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};

export const mesDeISO = (f) => NOMBRES_MES[Number(f.slice(5, 7)) - 1];
