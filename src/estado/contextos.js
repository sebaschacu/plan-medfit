import { createContext, useContext } from 'react';

// ═══════════════ LOS TRES CONTEXTOS ═══════════════
// Separados por FRECUENCIA DE CAMBIO, no por tema. Con un contexto único,
// marcar una serie re-renderizaría todo lo que lee cualquier cosa del estado.
//
//   ContextoPlan      cambia poco: al editar un día, navegar, importar…
//   ContextoProgreso  cambia en cada toque de serie y cada tic del temporizador
//   ContextoAcciones  no cambia nunca: todos los callbacks son useCallback
//                     estables, así que quien solo dispara acciones no se
//                     re-renderiza jamás por el estado.
//
// Los rellena PlanProvider.jsx. Van en archivo aparte para que ese solo
// exporte el componente (Fast Refresh lo exige).
export const ContextoPlan = createContext(null);
export const ContextoProgreso = createContext(null);
export const ContextoAcciones = createContext(null);

export const usePlanCtx = () => useContext(ContextoPlan);
export const useProgresoCtx = () => useContext(ContextoProgreso);
export const useAccionesCtx = () => useContext(ContextoAcciones);
