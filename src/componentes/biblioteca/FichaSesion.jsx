import React from 'react';
import { ArrowLeft, Pencil } from 'lucide-react';
import { SESIONES, SESION_INFO, PARTES } from '../../data.js';
import { resolverRutina, estaEditada } from '../../rutina.js';
import { usePlanCtx } from '../../estado/contextos.js';
import { COLUMNA } from '../../utiles/constantes-ui.js';
import FichaEjercicio from '../comunes/FichaEjercicio.jsx';
import { Detalle, Punto, BotonCTA } from '../comunes/ui.jsx';

// ═══════════════ FICHA DE SESIÓN (solo lectura) ═══════════════
// Enseña la rutina VIGENTE hoy para esa sesión. Editar está a un toque, abajo.
const FichaSesion = ({ sesionKey, onCerrar, onEditar }) => {
  const { todayISO, rutina } = usePlanCtx();
  const ses = SESIONES[sesionKey];
  const info = SESION_INFO[sesionKey];
  if (!ses) return null;
  const lista = resolverRutina(sesionKey, todayISO, rutina) ?? ses.ejercicios;
  const series = lista.filter(e => !e.opcional).reduce((a, e) => a + (typeof e.series === 'number' ? e.series : 0), 0);
  const editada = estaEditada(sesionKey, todayISO, rutina);
  const esGym = String(sesionKey).startsWith('gym');
  let n = 0;
  let parteAnterior = null;
  return (
    <div className="min-h-screen bg-fondo">
      <header className={`px-4 pt-3 pb-2 ${COLUMNA}`}>
        <button onClick={onCerrar} className="h-11 flex items-center gap-1.5 text-tinta3 text-[15px] font-medium">
          <ArrowLeft size={20} /> Volver
        </button>
        <div className="px-1">
          <div className="flex items-center gap-2 text-[15px]"><Punto color={info.color} /><span className="font-semibold" style={{ color: info.color }}>{info.tipo}</span></div>
          <h1 className="text-[30px] leading-9 font-semibold tracking-[-0.02em] text-tinta mt-1">{ses.nombre}</h1>
          <p className="text-[15px] text-tinta3 mt-1">
            {lista.length ? `${lista.length} ${esGym ? 'ejercicios' : 'bloques'}${esGym ? ` · ${series} series obligatorias` : ''} · ` : ''}{String(ses.duracion ?? '').split('·')[0].trim()}
          </p>
        </div>
      </header>
      <main className={`px-4 ${COLUMNA} ${onEditar ? 'pb-48' : 'pb-28'} space-y-3`}>
        {editada && (
          <p className="px-4 py-3 rounded-2xl text-[15px] text-ambar" style={{ background: 'rgba(245,158,11,0.10)' }}>
            Rutina editada · la versión de hoy no es la original del plan.
          </p>
        )}
        {ses.chequeo && <Detalle>{ses.chequeo}</Detalle>}
        {ses.recortada && <Detalle resumen="Versión recortada (45 min)">{ses.recortada}</Detalle>}
        {lista.length === 0
          ? <p className="text-[15px] text-tinta3 py-6 text-center">Día de recuperación: sin ejercicios.</p>
          : (
            <section className="rounded-3xl bg-tarjeta px-4">
              {lista.map(ex => {
                n += 1;
                const parte = ex.parte ?? 1;
                const cabecera = esGym && parte !== parteAnterior && PARTES[parte];
                parteAnterior = parte;
                return (
                  <React.Fragment key={ex.id}>
                    {cabecera && <h2 className="text-sm font-medium text-tinta3 pt-4 pb-1">{PARTES[parte].label}</h2>}
                    <div className="border-b border-divisor last:border-0"><FichaEjercicio ex={ex} numero={n} /></div>
                  </React.Fragment>
                );
              })}
            </section>
          )}
      </main>
      {onEditar && lista.length > 0 && (
        <div className="fixed inset-x-0 z-30 px-4 pt-2 pb-3 bg-fondo" style={{ bottom: 'calc(72px + env(safe-area-inset-bottom))' }}>
          <div className={COLUMNA}>
            <BotonCTA color="#e8edf0" onClick={() => onEditar(sesionKey)}><Pencil size={20} /> Editar esta rutina</BotonCTA>
          </div>
        </div>
      )}
    </div>
  );
};

export default FichaSesion;
