import React, { useMemo } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { SESION_INFO, SECUENCIA_NATACION, RUNNING_SESIONES, RUTINAS_GYM, SECUENCIA_GYM, SECUENCIA_BICI, PLAN_BOGOTA, clavePrincipal, claveSecundaria } from '../../data.js';
import { claveDeporte } from '../../config.js';
import { generarDesdeAncla, aISO, deISO } from '../../generador.js';
import { estaEditada } from '../../rutina.js';
import { COLUMNA, NOMBRES_MES } from '../../utiles/constantes-ui.js';
import { usePlanCtx } from '../../estado/contextos.js';
import { Punto } from '../comunes/ui.jsx';

// ═══════════════ RUTINAS ═══════════════
// Qué trae cada sesión y cuándo vuelve a tocar. El gym va en el orden de la
// rotación, que es como se vive; la natación y el running en sus dos bloques.
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const HORIZONTE = 60;   // días hacia delante en los que se busca la próxima fecha

const textoFecha = (f, hoy) => {
  if (!f) return 'Sin fecha';
  if (f === hoy) return 'Hoy';
  const d = deISO(f);
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()}${f.slice(0, 7) !== hoy.slice(0, 7) ? ` ${NOMBRES_MES[d.getUTCMonth()].slice(0, 3).toLowerCase()}` : ''}`;
};

const Fila = ({ k, fecha, hoy, editada, onAbrir, sub, abrirEn }) => {
  const info = SESION_INFO[k];
  return (
    <button onClick={() => onAbrir(k, abrirEn)} className="w-full min-h-[60px] py-2.5 flex items-center gap-3 text-left">
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

const Biblioteca = ({ onAbrir, onNuevoDeporte }) => {
  const { todayISO, ancla, fijados, festivos, rutina, config, planCfg } = usePlanCtx();

  // Próxima fecha de cada sesión, contando hoy. Se genera desde el ancla, igual
  // que el calendario, para que la fecha coincida con la que se verá allí.
  const proxima = useMemo(() => {
    const hasta = new Date(deISO(todayISO).getTime() + HORIZONTE * 864e5);
    const { dias } = generarDesdeAncla({ hasta: aISO(hasta), ancla, fijados, festivos, config });
    const p = {}, bogota = {};
    dias.filter(d => d.fecha >= todayISO).forEach(d => {
      [clavePrincipal(d), claveSecundaria(d)]
        .filter(Boolean).forEach(k => { p[k] ??= d.fecha; if (d.fecha >= PLAN_BOGOTA.desde) bogota[k] ??= d.fecha; });
    });
    return { p, bogota };
  }, [todayISO, ancla, fijados, festivos, config]);

  // Hasta el 29 de noviembre conviven dos planes: el de ahora (arriba) y el de
  // Bogotá, que se puede consultar antes de que empiece.
  const antesDeBogota = todayISO < PLAN_BOGOTA.desde;
  const fila = (k, sub) => (
    <Fila key={k} k={k} fecha={proxima.p[k]} hoy={todayISO} sub={sub}
      editada={estaEditada(k, todayISO, rutina)} onAbrir={onAbrir} />
  );
  const filaBogota = (k, sub) => (
    <Fila key={k} k={k} fecha={proxima.bogota[k]} hoy={todayISO} sub={sub} abrirEn={antesDeBogota ? PLAN_BOGOTA.desde : undefined}
      editada={estaEditada(k, antesDeBogota ? PLAN_BOGOTA.desde : todayISO, rutina)} onAbrir={onAbrir} />
  );
  const total = Object.keys(SESION_INFO).filter(k => k !== 'natacion' && k !== 'descanso' && !SESION_INFO[k].archivado).length;
  // El gym va en el orden de SU rotación (la del plan o la de Ajustes); las
  // sesiones que el usuario sacó de la rotación siguen aquí, aparte.
  // La rutina activa en su orden; aparte, las de su opción fuera de la cola y la
  // otra rutina, guardada (se activa en Ajustes → Orden de rotación).
  const activa = RUTINAS_GYM[planCfg.rutinaGym] ?? RUTINAS_GYM.A;
  const otra = Object.entries(RUTINAS_GYM).find(([o]) => o !== planCfg.rutinaGym)?.[1];
  const fueraGym = activa.secuencia.filter(k => !planCfg.secGym.includes(k));
  const deportes = (config.deportes ?? []).filter(d => !d.archivado);
  const bloqueA = SECUENCIA_NATACION.filter(k => k.startsWith('natA'));
  const bloqueB = SECUENCIA_NATACION.filter(k => k.startsWith('natB'));
  // El running, como el gym: en el orden de su rotación, y aparte las que no entran.
  const fueraRun = RUNNING_SESIONES.filter(k => !planCfg.secRun.includes(k));

  return (
    <div className="min-h-screen bg-fondo">
      <header className={`px-5 pt-5 pb-3 ${COLUMNA}`}>
        <h1 className="text-[30px] leading-9 font-semibold tracking-[-0.02em] text-tinta">Rutinas</h1>
        <p className="text-[15px] text-tinta3 mt-0.5">{total} rutinas · toca una para verla o editarla</p>
      </header>
      <main className={`px-4 ${COLUMNA} pb-28 space-y-3`}>
        {antesDeBogota && (
          <section className="rounded-3xl bg-tarjeta px-5 pt-4 pb-1">
            <div className="rotulo">Gym · hasta el 29 de noviembre</div>
            <div className="divide-y divide-divisor">{SECUENCIA_GYM.map(k => fila(k))}</div>
          </section>
        )}

        <section className="rounded-3xl bg-tarjeta px-5 pt-4 pb-1">
          <div className="rotulo">{antesDeBogota ? `Bogotá · desde el 30 nov · ${activa.label}` : `Gym · ${activa.label}`}</div>
          <div className="divide-y divide-divisor">{planCfg.secGym.map(k => filaBogota(k))}</div>
          {activa.extra.length > 0 && (
            <div className="border-t border-divisor divide-y divide-divisor">{activa.extra.map(k => filaBogota(k, 'Opcional · la eliges tú en el día'))}</div>
          )}
          {fueraGym.length > 0 && (
            <>
              <div className="text-sm text-tinta3 mt-3">Fuera de la rotación</div>
              <div className="divide-y divide-divisor">{fueraGym.map(k => filaBogota(k, 'No entra sola en el calendario'))}</div>
            </>
          )}
        </section>

        {otra && (
          <section className="rounded-3xl bg-tarjeta px-5 pt-4 pb-1">
            <div className="rotulo">Guardada · {otra.label}</div>
            <p className="text-sm text-tinta3 mt-1.5">Se activa en Ajustes → Orden de rotación.</p>
            <div className="divide-y divide-divisor">{[...otra.secuencia, ...otra.extra].map(k => filaBogota(k))}</div>
          </section>
        )}

        <section className="rounded-3xl bg-tarjeta px-5 pt-4 pb-1">
          <div className="rotulo">Natación</div>
          <div className="text-sm text-tinta3 mt-2">Bloque A · técnica y estilos</div>
          <div className="divide-y divide-divisor">{bloqueA.map(k => fila(k, ''))}</div>
          <div className="text-sm text-tinta3 mt-3">Bloque B · crawl y umbral</div>
          <div className="divide-y divide-divisor">{bloqueB.map(k => fila(k, ''))}</div>
          <div className="border-t border-divisor mt-1">{fila('natCSS', 'Cada 6-8 semanas, en vez de un Umbral')}</div>
        </section>

        <section className="rounded-3xl bg-tarjeta px-5 pt-4 pb-1">
          <div className="rotulo">Running · rotación</div>
          <div className="divide-y divide-divisor">{planCfg.secRun.map(k => fila(k))}</div>
          <div className="border-t border-divisor divide-y divide-divisor">
            {fila('runTest', 'Cada ~12 carreras')}
          </div>
          <div className="text-sm text-tinta3 mt-3">Para un día suelto</div>
          <div className="divide-y divide-divisor">
            {fueraRun.map(k => fila(k))}
            {fila('running', 'Carrera que añades tú')}
          </div>
        </section>

        <section className="rounded-3xl bg-tarjeta px-5 pt-4 pb-1">
          <div className="rotulo">Cardio y otros</div>
          <div className="text-sm text-tinta3 mt-2">Bici · el cardio de Bogotá, alternando</div>
          <div className="divide-y divide-divisor">{SECUENCIA_BICI.map(k => filaBogota(k))}</div>
          <div className="divide-y divide-divisor border-t border-divisor">
            {fila('ciclismo')}
            {fila('calistenia', 'Complemento sobre otro día')}
          </div>
        </section>

        <section className="rounded-3xl bg-tarjeta px-5 pt-4 pb-1">
          <div className="rotulo">Tus deportes</div>
          {deportes.length > 0 && <div className="divide-y divide-divisor">{deportes.map(d => fila(claveDeporte(d.id)))}</div>}
          {onNuevoDeporte && (
            <button onClick={onNuevoDeporte}
              className={`w-full min-h-[56px] flex items-center gap-3 text-left text-[17px] text-tinta ${deportes.length ? 'border-t border-divisor' : ''}`}>
              <span className="w-8 h-8 rounded-xl bg-elevada flex items-center justify-center text-tinta2 flex-shrink-0"><Plus size={18} /></span>
              {deportes.length ? 'Añadir otro deporte' : 'Añadir un deporte'}
            </button>
          )}
        </section>
      </main>
    </div>
  );
};

export default Biblioteca;
