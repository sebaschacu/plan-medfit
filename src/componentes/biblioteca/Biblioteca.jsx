import React, { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { SESION_INFO, SECUENCIA_GYM, SECUENCIA_NATACION } from '../../data.js';
import { generarDesdeAncla, aISO, deISO } from '../../generador.js';
import { estaEditada } from '../../rutina.js';
import { COLUMNA, NOMBRES_MES } from '../../utiles/constantes-ui.js';
import { usePlanCtx } from '../../estado/contextos.js';
import { Punto } from '../comunes/ui.jsx';

// ═══════════════ RUTINAS ═══════════════
// Qué trae cada sesión y cuándo vuelve a tocar. El gym va en el orden de la
// rotación, que es como se vive; la natación en sus dos bloques.
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const HORIZONTE = 60;   // días hacia delante en los que se busca la próxima fecha

const textoFecha = (f, hoy) => {
  if (!f) return 'Sin fecha';
  if (f === hoy) return 'Hoy';
  const d = deISO(f);
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()}${f.slice(0, 7) !== hoy.slice(0, 7) ? ` ${NOMBRES_MES[d.getUTCMonth()].slice(0, 3).toLowerCase()}` : ''}`;
};

const Fila = ({ k, fecha, hoy, editada, onAbrir, sub }) => {
  const info = SESION_INFO[k];
  return (
    <button onClick={() => onAbrir(k)} className="w-full min-h-[60px] py-2.5 flex items-center gap-3 text-left">
      <Punto color={info.color} />
      <span className="flex-1 min-w-0">
        <span className="block text-[17px] text-tinta leading-snug">{info.label}</span>
        {(sub ?? info.tipo) || editada ? (
          <span className="block text-sm text-tinta3 truncate">{sub ?? info.tipo}{editada && <span className="text-ambar">{(sub ?? info.tipo) ? ' · ' : ''}editada</span>}</span>
        ) : null}
      </span>
      <span className={`text-[15px] flex-shrink-0 ${fecha === hoy ? 'text-tinta font-semibold' : 'text-tinta3'}`}>{textoFecha(fecha, hoy)}</span>
      <ChevronRight size={18} className="text-mudo flex-shrink-0" />
    </button>
  );
};

const Biblioteca = ({ onAbrir }) => {
  const { todayISO, ancla, fijados, festivos, rutina } = usePlanCtx();

  // Próxima fecha de cada sesión, contando hoy. Se genera desde el ancla, igual
  // que el calendario, para que la fecha coincida con la que se verá allí.
  const proxima = useMemo(() => {
    const hasta = new Date(deISO(todayISO).getTime() + HORIZONTE * 864e5);
    const { dias } = generarDesdeAncla({ hasta: aISO(hasta), ancla, fijados, festivos });
    const p = {};
    dias.filter(d => d.fecha >= todayISO).forEach(d => {
      [d.sesion === 'natacion' ? d.variante : d.sesion,
        d.sesionSecundaria === 'natacion' ? d.varianteSecundaria : d.sesionSecundaria]
        .filter(Boolean).forEach(k => { p[k] ??= d.fecha; });
    });
    return p;
  }, [todayISO, ancla, fijados, festivos]);

  const fila = (k, sub) => (
    <Fila key={k} k={k} fecha={proxima[k]} hoy={todayISO} sub={sub}
      editada={estaEditada(k, todayISO, rutina)} onAbrir={onAbrir} />
  );
  const total = Object.keys(SESION_INFO).filter(k => k !== 'natacion' && k !== 'descanso').length;
  const bloqueA = SECUENCIA_NATACION.filter(k => k.startsWith('natA'));
  const bloqueB = SECUENCIA_NATACION.filter(k => k.startsWith('natB'));

  return (
    <div className="min-h-screen bg-fondo">
      <header className={`px-5 pt-5 pb-3 ${COLUMNA}`}>
        <h1 className="text-[30px] leading-9 font-semibold tracking-[-0.02em] text-tinta">Rutinas</h1>
        <p className="text-[15px] text-tinta3 mt-0.5">{total} rutinas · toca una para verla o editarla</p>
      </header>
      <main className={`px-4 ${COLUMNA} pb-28 space-y-3`}>
        <section className="rounded-3xl bg-tarjeta px-5 pt-4 pb-1">
          <div className="rotulo">Gym · rotación</div>
          <div className="divide-y divide-divisor">{SECUENCIA_GYM.map(k => fila(k))}</div>
        </section>

        <section className="rounded-3xl bg-tarjeta px-5 pt-4 pb-1">
          <div className="rotulo">Natación</div>
          <div className="text-sm text-tinta3 mt-2">Bloque A · técnica y estilos</div>
          <div className="divide-y divide-divisor">{bloqueA.map(k => fila(k, ''))}</div>
          <div className="text-sm text-tinta3 mt-3">Bloque B · crawl y umbral</div>
          <div className="divide-y divide-divisor">{bloqueB.map(k => fila(k, ''))}</div>
          <div className="border-t border-divisor mt-1">{fila('natCSS', 'Cada 6-8 semanas, en vez de un Umbral')}</div>
        </section>

        <section className="rounded-3xl bg-tarjeta px-5 pt-4 pb-1">
          <div className="rotulo">Cardio y otros</div>
          <div className="divide-y divide-divisor">
            {fila('running')}
            {fila('ciclismo')}
            {fila('calistenia', 'Complemento sobre otro día')}
          </div>
        </section>
      </main>
    </div>
  );
};

export default Biblioteca;
