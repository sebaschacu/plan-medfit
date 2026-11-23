import React from 'react';
import { ArrowLeft, ArrowRight, Settings, Star, Clock, Moon, AlertTriangle, ChevronRight } from 'lucide-react';
import { SESION_INFO, GRUPOS_SESION as GRUPOS, PISCINA_DURACION_MIN, clavePrincipal, claveSecundaria } from '../../data.js';
import { S4, SUENO_POCO, SUENO_BIEN, ultimaSesion, sugerirCarga } from '../../reglas.js';
import { ejerciciosDelDia, sesionBase } from '../../rutina.js';
import { VACIO, COLUMNA, NOMBRES_MES } from '../../utiles/constantes-ui.js';
import { anotaCarga, proponerSerie, serieQueToca } from '../../utiles/serie.js';
import { contarRender } from '../../utiles/medir.js';
import { usePlanCtx, useProgresoCtx, useAccionesCtx } from '../../estado/contextos.js';
import IconFor from '../comunes/IconFor.jsx';
import { Punto, ChipTurno, Detalle, BotonCTA } from '../comunes/ui.jsx';
import SelectorVariante from './SelectorVariante.jsx';
import PanelFlexible from './PanelFlexible.jsx';
import PanelDia from './PanelDia.jsx';
import RachaYMes from '../comunes/RachaYMes.jsx';

// ═══════════════ EL DÍA ═══════════════
// Qué toca y con qué se empieza, de un vistazo. Con la fecha de hoy es la
// pestaña «Hoy»; con otra fecha, el día abierto desde el calendario.
// Aquí vive todo lo que es del DÍA y no de un ejercicio: sueño, cambiar la
// sesión, segunda sesión, calistenia. Los ejercicios están a un toque.
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const diaSemana = (f) => DIAS[new Date(f + 'T00:00:00Z').getUTCDay()];
const mesCorto = (f) => NOMBRES_MES[Number(f.slice(5, 7)) - 1].slice(0, 3).toLowerCase();

// Nombre de lo que toca un día: la natación dice además cuál de las suyas.
const claveDe = clavePrincipal;
const nSeries = (ex) => (typeof ex.series === 'number' ? ex.series : 1);

const DiaView = ({ onVerFicha }) => {
  contarRender('DiaView');
  const { todayISO, rutina, activeFecha, diaActivo: dia, claveVista: sesionKey, ejerciciosVigentes, calendario } = usePlanCtx();
  const { progress } = useProgresoCtx();
  const { backToCalendar, irA, onSueno, abrirSesionDelDia } = useAccionesCtx();

  const esHoy = activeFecha === todayISO;
  const ses = sesionBase(sesionKey, activeFecha);
  const info = SESION_INFO[sesionKey];
  const color = ses.color;
  const lista = ejerciciosVigentes ?? ses.ejercicios;
  const dayProg = progress[activeFecha] || VACIO;
  const registrados = Object.keys(dayProg).filter(k => !k.startsWith('__')).length;
  const completo = (ex) => { const sc = nSeries(ex); const p = dayProg[ex.id]; return sc > 0 && p?.sets?.length === sc && p.sets.every(Boolean); };
  const hechos = lista.filter(completo).length;
  const terminada = lista.length > 0 && hechos === lista.length;
  const s4 = dia.turno === 'P' ? S4(dayProg.__sueno) : null;
  const reducida = s4?.nivel === 'reducida';

  // Con qué se empieza (o se sigue): el primer ejercicio sin terminar.
  const primero = lista.find(ex => !completo(ex));
  const carga = primero && anotaCarga(primero)
    ? proponerSerie(primero, dayProg[primero.id], Math.max(0, serieQueToca(dayProg[primero.id], nSeries(primero))),
      sugerirCarga(primero, progress, { hasta: activeFecha, descarga: !!dia.descarga }),
      ultimaSesion(progress, primero.id, activeFecha))
    : null;

  const proximos = calendario.filter(d => d.fecha > activeFecha).slice(0, 2);
  const sec = dia.sesionSecundaria;
  const claveSec = claveSecundaria(dia);
  const listaSec = sec ? ejerciciosDelDia(claveSec, activeFecha, rutina, progress[activeFecha]) : [];

  return (
    <div className="min-h-screen bg-fondo">
      <header className={`px-5 pt-4 pb-2 ${COLUMNA}`}>
        {!esHoy && (
          <button onClick={backToCalendar} className="h-11 -ml-1 flex items-center gap-1.5 text-tinta3 text-sm font-medium">
            <ArrowLeft size={18} /> Calendario
          </button>
        )}
        <div className="flex items-center gap-3 min-h-[44px]">
          <div className="text-[17px] font-semibold text-tinta">{diaSemana(dia.fecha)} {dia.dia} {mesCorto(dia.fecha)}</div>
          <ChipTurno turno={dia.turno} conNombre />
          {dia.festivo && <Star size={16} className="text-pink-400" fill="currentColor" aria-label="Festivo" />}
          <button onClick={() => irA('ajustes')} aria-label="Ajustes" className="ml-auto w-11 h-11 -mr-2 flex items-center justify-center text-tinta3">
            <Settings size={22} />
          </button>
        </div>
      </header>

      <main className={`px-4 ${COLUMNA} ${lista.length > 0 ? 'pb-48' : 'pb-28'} space-y-3`}>
        {/* ─── Qué toca ─── */}
        <section className="rounded-3xl bg-tarjeta p-5">
          <div className="flex items-center gap-2 text-[15px]">
            <IconFor name={info?.icon} size={18} color={color} />
            <span className="font-semibold" style={{ color }}>{GRUPOS[info?.grupo]?.label ?? info?.label}</span>
            {lista.length > 0 && <span className="text-tinta3">· {lista.length} {esAguaOCardio(sesionKey) ? 'bloques' : 'ejercicios'}</span>}
            {terminada && <span className="text-tinta3">· hecha</span>}
          </div>
          {/* El nombre abre la ficha de la sesión: es la consulta más frecuente */}
          <button onClick={() => onVerFicha?.(sesionKey)} className="text-left mt-1 min-h-[44px] flex items-center gap-1" aria-label={`Ver la rutina de ${ses.nombre}`}>
            <h1 className="text-[30px] leading-9 font-semibold tracking-[-0.02em] text-tinta">{ses.nombre}</h1>
            {lista.length > 0 && <ChevronRight size={20} className="text-mudo flex-shrink-0 mt-1" />}
          </button>
          <p className="text-[15px] text-tinta2 mt-1.5">{dia.momento}{lista.length > 0 ? ` · ${ses.subtitulo}` : ''}</p>

          {/* S4 · sueño en posturno: dos tramos, dos botones */}
          {dia.turno === 'P' && lista.length > 0 && (
            <div className="mt-4 pt-4 border-t border-divisor">
              <div className="text-[15px] text-tinta2 mb-2.5">¿Cuánto dormiste?</div>
              <div className="grid grid-cols-2 gap-2.5" role="group" aria-label="Horas de sueño">
                {[[SUENO_POCO, 'Menos de 6 h', 'sesión reducida'], [SUENO_BIEN, '6 h o más', 'sesión normal']].map(([v, t, sub]) => {
                  const on = dayProg.__sueno != null && (Number(dayProg.__sueno) < 6) === (v < 6);
                  return (
                    <button key={v} onClick={() => onSueno(on ? null : v)} aria-pressed={on}
                      className={`h-[60px] rounded-2xl flex flex-col items-center justify-center ${on ? 'bg-fondo' : 'bg-elevada'}`}
                      style={on ? { boxShadow: `inset 0 0 0 2px ${v < 6 ? '#f5b54a' : color}` } : undefined}>
                      <span className="text-base font-semibold text-tinta">{t}</span>
                      <span className="text-sm text-tinta3">{sub}</span>
                    </button>
                  );
                })}
              </div>
              {s4 && <p className="text-sm mt-2.5 leading-relaxed" style={{ color: reducida ? '#f5b54a' : '#8a97a1' }}>{s4.texto}</p>}
            </div>
          )}

          {primero && (
            <div className="mt-4 rounded-2xl bg-elevada px-4 py-3.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-tinta3">{registrados > 0 ? 'Sigues con' : 'Empiezas con'}</div>
                <div className="text-[17px] font-semibold text-tinta leading-snug">{primero.nombre}</div>
              </div>
              <div className="text-right flex-shrink-0">
                {carga?.kg != null && <div className="text-2xl font-semibold text-tinta leading-none">{carga.kg} <span className="text-sm text-tinta3 font-medium">kg</span></div>}
                <div className="text-sm text-tinta3 mt-1">{primero.series} × {primero.reps}</div>
              </div>
            </div>
          )}
        </section>

        {/* Racha y mes: solo en Hoy, que es donde se miran a diario */}
        {esHoy && <RachaYMes />}

        {/* ─── Avisos del día ─── */}
        {dia.festivo && (
          <Detalle icono={<Star size={18} className="text-pink-400" fill="currentColor" />}>
            <b>Día festivo en Colombia.</b>
            {dia.sesion === 'natacion'
              ? ' La piscina universitaria está cerrada hoy. Cambia a running, calistenia o descanso desde el calendario.'
              : ' La piscina universitaria está cerrada, pero el gym y las demás sesiones no se afectan.'}
          </Detalle>
        )}
        {dia.franja?.hora != null && (
          <div className="rounded-2xl bg-tarjeta px-4 py-3 flex items-start gap-3">
            <Clock size={18} className="flex-shrink-0 mt-0.5" style={{ color: '#06b6d4' }} />
            <p className="text-[15px] text-tinta2 leading-relaxed">
              <b className="text-tinta">Piscina a las {dia.franja.hora}:00–{dia.franja.hora + PISCINA_DURACION_MIN / 60}:00</b>
              {dia.franja.guiado
                ? ' · Entrenamiento guiado. Hay coach: aprovéchalo para técnica.'
                : ' · Práctica libre (no había franja guiada compatible con este turno).'}
            </p>
          </div>
        )}
        {dia.descarga && (
          <Detalle icono={<Moon size={18} />} resumen={`Semana ${dia.semanaBloque} del bloque: DESCARGA (P4)`}>
            Hoy haces la <b>mitad de las series</b> y dejas <b>2 repeticiones más en el tanque</b> (RIR +2).
            Esta semana solo se dobla con lo suave —natación o bici— (D3): nada de running doblado ni gym extra.
            Prioriza dormir — la descarga es donde se consolida lo de las siete semanas anteriores.
          </Detalle>
        )}
        {/* D5 · con poco sueño, la segunda sesión del día se propone saltar */}
        {sec && dayProg.__sueno != null && Number(dayProg.__sueno) < 6 && (
          <Detalle tono="ambar" abiertoInicial icono={<AlertTriangle size={18} />} resumen="Hoy, sin segunda sesión (D5)">
            Con menos de 6 h de sueño, sáltate la segunda sesión de hoy. Doblar con déficit de sueño no te da adaptación, te da fatiga acumulada.
          </Detalle>
        )}

        {/* Día flexible · las tres condiciones */}
        {dia.flexible && <PanelFlexible dia={dia} respuesta={dia.flexRespuesta} />}

        {/* Cuál de la cola toca hoy, y cambiarla sin romper la rotación */}
        <SelectorVariante dia={dia} registrados={registrados} />
        {sec && <SelectorVariante dia={dia} secundaria registrados={registrados} />}

        {lista.length > 0 && <Detalle>{ses.chequeo}</Detalle>}

        {/* Segunda sesión y complementos */}
        <PanelDia dia={dia} reducida={reducida} nEjerciciosSec={listaSec.length} />

        {lista.length === 0 && !dia.flexible && (
          <div className="rounded-3xl bg-tarjeta p-5 text-center">
            <Moon size={32} className="text-tenue mx-auto mb-2" />
            <h2 className="text-xl font-semibold text-tinta2">Día de descanso</h2>
            <p className="text-[15px] text-tinta3 mt-1">El sueño es tu factor limitante real. Hoy recuperas. Máximo unos dead hangs suaves si te apetece.</p>
          </div>
        )}

        {/* ─── Lo que viene ─── */}
        {proximos.length > 0 && (
          <section>
            <h2 className="text-[15px] text-tinta3 px-1 mb-2 mt-1">Próximos días</h2>
            <div className="rounded-3xl bg-tarjeta px-4 divide-y divide-divisor">
              {proximos.map(d => {
                const k = claveDe(d);
                return (
                  <div key={d.fecha} className="min-h-[52px] py-2 flex items-center gap-3 text-base">
                    <span className="w-16 text-tinta3 whitespace-nowrap">{diaSemana(d.fecha).slice(0, 3)} {d.dia}</span>
                    <ChipTurno turno={d.turno} />
                    <Punto color={SESION_INFO[k]?.color} />
                    <span className="flex-1 min-w-0 truncate text-tinta">
                      {k !== d.sesion ? `${SESION_INFO[d.sesion]?.label} · ${SESION_INFO[k]?.label}` : (d.flexible ? 'Día flexible' : SESION_INFO[k]?.label)}
                      {d.sesionSecundaria ? ` + ${SESION_INFO[d.sesionSecundaria]?.label}` : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {lista.length > 0 && (
        <div className="fixed inset-x-0 z-30 px-4 pt-2 pb-3 bg-fondo" style={{ bottom: 'calc(72px + env(safe-area-inset-bottom))' }}>
          <div className={COLUMNA}>
            <BotonCTA color={color} onClick={() => abrirSesionDelDia(null)}>
              {terminada ? 'Ver sesión' : registrados > 0 ? `Continuar · ${hechos}/${lista.length}` : reducida ? 'Empezar versión reducida' : 'Empezar sesión'}
              <ArrowRight size={22} strokeWidth={2.4} />
            </BotonCTA>
          </div>
        </div>
      )}
    </div>
  );
};

const esAguaOCardio = (k) => String(k).startsWith('nat') || String(k).startsWith('run') || k === 'ciclismo';

export default DiaView;
