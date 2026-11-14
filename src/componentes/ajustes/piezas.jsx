import React, { useMemo } from 'react';
import { ArrowLeft, Minus, Plus, ChevronRight, AlertTriangle } from 'lucide-react';
import { COLUMNA } from '../../utiles/constantes-ui.js';
import { previsualizar } from '../../utiles/previa.js';
import { usePlanCtx } from '../../estado/contextos.js';

// ═══════════════ PIEZAS DE AJUSTES ═══════════════
// Lo que comparten las pantallas de configuración del plan.

// Una pantalla de ajuste: volver arriba, título, contenido, y abajo Guardar.
// Nada se aplica hasta pulsar Guardar: así un ciclo a medio editar nunca
// llega a pintar un calendario raro.
export const Pantalla = ({ titulo, subtitulo, volver = 'Ajustes', onVolver, onGuardar, puedeGuardar = true, textoGuardar = 'Guardar', children }) => (
  <div className="min-h-screen bg-fondo">
    <header className={`px-4 pt-3 pb-2 ${COLUMNA}`}>
      <button onClick={onVolver} className="h-11 flex items-center gap-1.5 text-tinta3 text-[15px] font-medium">
        <ArrowLeft size={20} /> {volver}
      </button>
      <h1 className="text-[30px] leading-9 font-semibold tracking-[-0.02em] text-tinta px-1">{titulo}</h1>
      {subtitulo && <p className="text-[15px] text-tinta3 mt-1 px-1">{subtitulo}</p>}
    </header>
    <main className={`px-4 ${COLUMNA} ${onGuardar ? 'pb-56' : 'pb-28'} space-y-3`}>{children}</main>
    {onGuardar && (
      <div className="fixed inset-x-0 z-30 px-4 pt-2 pb-3 bg-fondo border-t border-divisor" style={{ bottom: 'calc(72px + env(safe-area-inset-bottom))' }}>
        <div className={`${COLUMNA} flex gap-2.5`}>
          <button onClick={onVolver} className="flex-1 h-[56px] rounded-2xl bg-elevada text-tinta text-base font-semibold">Cancelar</button>
          <button onClick={onGuardar} disabled={!puedeGuardar}
            className="flex-[1.6] h-[56px] rounded-2xl bg-tinta text-[#0d1215] text-base font-semibold disabled:opacity-40">{textoGuardar}</button>
        </div>
      </div>
    )}
  </div>
);

// Fila de menú: título, una línea de resumen y, si cambió, la etiqueta.
export const Fila = ({ titulo, resumen, cambiado, onClick, icono }) => (
  <button onClick={onClick} className="w-full min-h-[68px] px-5 py-3 flex items-center gap-3.5 text-left">
    {icono && <span className="w-10 h-10 rounded-xl bg-elevada flex items-center justify-center text-tinta2 flex-shrink-0">{icono}</span>}
    <span className="flex-1 min-w-0">
      <span className="flex items-center gap-2">
        <span className="text-[17px] font-medium text-tinta">{titulo}</span>
        {cambiado && <span className="h-6 px-2 rounded-lg text-xs font-semibold text-ambar inline-flex items-center" style={{ background: 'rgba(245,158,11,0.10)' }}>Cambiado</span>}
      </span>
      <span className="block text-sm text-tinta3 truncate">{resumen}</span>
    </span>
    <ChevronRight size={18} className="text-mudo flex-shrink-0" />
  </button>
);

// Contador con − y +, de min a max.
export const Paso = ({ label, sub, valor, min, max, onCambiar }) => (
  <div className="min-h-[64px] px-5 py-2.5 flex items-center gap-3">
    <span className="flex-1 min-w-0">
      <span className="block text-[17px] text-tinta">{label}</span>
      {sub && <span className="block text-sm text-tinta3">{sub}</span>}
    </span>
    <button onClick={() => onCambiar(Math.max(min, valor - 1))} disabled={valor <= min} aria-label={`Menos ${label}`}
      className="w-11 h-11 rounded-xl bg-elevada text-tinta2 flex items-center justify-center disabled:opacity-30"><Minus size={18} /></button>
    <span className="w-8 text-center text-2xl font-semibold text-tinta" aria-label={`${label}: ${valor}`}>{valor}</span>
    <button onClick={() => onCambiar(Math.min(max, valor + 1))} disabled={valor >= max} aria-label={`Más ${label}`}
      className="w-11 h-11 rounded-xl bg-elevada text-tinta2 flex items-center justify-center disabled:opacity-30"><Plus size={18} /></button>
  </div>
);

// Interruptor de sí/no con su texto.
export const Interruptor = ({ label, sub, activo, onCambiar }) => (
  <button role="switch" aria-checked={!!activo} aria-label={label} onClick={() => onCambiar(!activo)}
    className="w-full min-h-[56px] px-5 py-2.5 flex items-center gap-3 text-left">
    <span className="flex-1 min-w-0">
      <span className="block text-[17px] text-tinta">{label}</span>
      {sub && <span className="block text-sm text-tinta3">{sub}</span>}
    </span>
    <span className={`w-12 h-7 rounded-full p-0.5 flex-shrink-0 ${activo ? 'bg-emerald-500' : 'bg-borde'}`} aria-hidden="true">
      <span className={`block w-6 h-6 rounded-full bg-tinta transition-transform ${activo ? 'translate-x-5' : ''}`} />
    </span>
  </button>
);

// Así quedaría: el calendario de las próximas cuatro semanas con el ajuste a
// medio editar, resumido en medias por semana y en lo que no cabría.
export const VistaPrevia = ({ config }) => {
  const { ancla, fijados, festivos, todayISO } = usePlanCtx();
  // Se recalcula solo cuando cambia el CONTENIDO de la config, no su identidad:
  // la pantalla la reconstruye en cada pintado.
  const clave = JSON.stringify(config);
  const p = useMemo(() => previsualizar({ ancla, fijados, festivos, config: JSON.parse(clave), desde: todayISO }),
    [ancla, fijados, festivos, clave, todayISO]);
  const cifras = [['Gym', p.gym], ['Natación', p.natacion], ['Running o bici', p.cardio], ...p.deportes, ['Descanso', p.descanso]];
  return (
    <section className="rounded-3xl bg-tarjeta p-5" aria-label="Así quedaría">
      <div className="rotulo">Así quedaría</div>
      <p className="text-sm text-tinta3 mt-1">Media por semana en las próximas {p.semanas} semanas</p>
      <div className="grid grid-cols-3 gap-x-3 gap-y-3 mt-3">
        {cifras.map(([l, v]) => (
          <div key={l} className="min-w-0">
            <div className="text-2xl font-semibold text-tinta leading-none">{v}</div>
            <div className="text-sm text-tinta3 mt-1 truncate">{l}</div>
          </div>
        ))}
      </div>
      {p.dobles > 0 && <p className="text-sm text-tinta3 mt-3">{p.dobles} {p.dobles === 1 ? 'día doblado' : 'días doblados'} por semana para que quepa todo.</p>}
      {p.nProblemas > 0 ? (
        <div className="mt-3 p-3.5 rounded-2xl flex items-start gap-2.5" style={{ background: 'rgba(245,158,11,0.10)' }}>
          <AlertTriangle size={18} className="text-ambar flex-shrink-0 mt-0.5" />
          <div className="text-sm text-[#f3d9a4] leading-relaxed space-y-1">
            <p className="font-semibold text-ambar">No cabe todo: {p.nProblemas} {p.nProblemas === 1 ? 'aviso' : 'avisos'} en estas semanas</p>
            {p.problemas.map((t, i) => <p key={i}>{t}</p>)}
          </div>
        </div>
      ) : (
        <p className="text-sm text-emerald-300 mt-3">Cabe todo.</p>
      )}
    </section>
  );
};
