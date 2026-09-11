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

export const parseRest = (s) => {
  if (!s || s === '—' || s.includes('0s')) return null;
  const n = parseFloat(s.replace(',', '.'));
  if (isNaN(n)) return null;
  const range = s.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
  const v = range ? parseFloat(range[2]) : n;
  return s.toLowerCase().includes('min') ? Math.round(v * 60) : Math.round(v);
};

export const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

// Fecha local de hoy en ISO (no UTC: si no, de noche en Colombia saltaría al día siguiente).
export const hoyISO = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};

export const mesDeISO = (f) => NOMBRES_MES[Number(f.slice(5, 7)) - 1];
