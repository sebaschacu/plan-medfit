import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { RotateCcw, ArrowLeft, AlertTriangle, Pencil, Check, Moon } from 'lucide-react';
import { SESION_INFO, SESIONES, PARTES, GRUPOS_SESION as GRUPOS, E11 } from '../../data.js';
import { S4, ultimaSesion, sugerirCarga } from '../../reglas.js';
import { estaEditada, huerfanosDelDia } from '../../rutina.js';
import { VACIO, COLUMNA } from '../../utiles/constantes-ui.js';
import { proponerSerie, textoSerie } from '../../utiles/serie.js';
import { contarRender } from '../../utiles/medir.js';
import { usePlanCtx, useProgresoCtx, useAccionesCtx } from '../../estado/contextos.js';
import RestTimer from '../comunes/RestTimer.jsx';
import { Detalle, BotonCTA } from '../comunes/ui.jsx';
import ExerciseCard from './ExerciseCard.jsx';
import HojaSerie from './HojaSerie.jsx';
import PanelCSS from './PanelCSS.jsx';

// ═══════════════ SESIÓN ═══════════════
// Solo los ejercicios. Lo que es del DÍA (sueño, segunda sesión, cambiar la
// sesión) vive en la pantalla del día: aquí se viene a entrenar.
// Hay un ejercicio abierto —el que toca— y el resto son filas.
const nSeries = (ex) => (typeof ex.series === 'number' ? ex.series : 1);
const estaCompleto = (ex, dayProg) => {
  const sc = nSeries(ex); const p = dayProg[ex.id];
  return sc > 0 && p?.sets?.length === sc && p.sets.every(Boolean);
};

const SessionView = ({ onEditarRutina, onVerFicha }) => {
  contarRender('SessionView');
  const { todayISO, rutina, activeFecha, diaActivo: diaData, claveVista: sesionKey, ejerciciosVigentes } = usePlanCtx();
  const { progress: progresoTotal, prMap, avisosReset, restTimer } = useProgresoCtx();
  const { backToCalendar: onBack, resetDay: onReset, skipTimer: onSkipTimer, registrarSerie, toggleSet } = useAccionesCtx();

  const progress = progresoTotal[activeFecha];
  const huerfanos = huerfanosDelDia(progress ?? {}, ejerciciosVigentes ?? []);
  const rutinaEditada = estaEditada(sesionKey, todayISO, rutina);

  const ses = SESIONES[sesionKey];
  const info = SESION_INFO[sesionKey];
  const color = ses.color;
  // Los ejercicios salen de la rutina VIGENTE en esta fecha, no de la base:
  // una sesión que entrenaste en septiembre conserva lo que hiciste entonces.
  const listaEj = ejerciciosVigentes ?? ses.ejercicios;
  const dayProg = progress || VACIO;

  const total = listaEj.length;
  const completed = useMemo(() => listaEj.filter(ex => estaCompleto(ex, dayProg)).length, [listaEj, dayProg]);
  const done = total > 0 && completed === total;
  // Las horas de sueño no cuentan como "progreso": si contaran, anotar el sueño
  // haría aparecer el botón de Reset en una sesión donde no has marcado nada.
  const anyProgress = Object.keys(dayProg).some(k => !k.startsWith('__'));

  // v6: agrupar por Parte 1 / 2 / 3 / Finisher, respetando el orden del plan
  const grupos = useMemo(() => {
    const orden = [1, 2, 3, 'finisher'];
    const map = new Map();
    listaEj.forEach(ex => {
      const k = ex.parte ?? 1;
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(ex);
    });
    return [...map.entries()].sort((a, b) => orden.indexOf(a[0]) - orden.indexOf(b[0]));
  }, [listaEj]);
  // Ni la natación ni el running tienen la estructura Parte 1/2/3 del gimnasio:
  // son bloques de una sesión aeróbica y esas etiquetas ahí no significan nada.
  const esAgua = String(sesionKey).startsWith('nat');
  const mostrarPartes = grupos.length > 1 && !esAgua && sesionKey !== 'running';
  const s4 = diaData.turno === 'P' ? S4(dayProg.__sueno) : null;
  // E11: bi-series que hoy se hacen por separado (nota del día, no de la rutina)
  const bsSueltas = Array.isArray(dayProg[E11.clave]) ? dayProg[E11.clave] : [];

  // ─── Qué ejercicio está abierto ───
  // Por defecto, el primero sin terminar: al cerrar un ejercicio se abre solo el
  // siguiente. Si se elige otro a mano se respeta, hasta que ese se termina.
  const [elegido, setElegido] = useState(null);       // { id, completo }
  const pendiente = listaEj.find(ex => !estaCompleto(ex, dayProg))?.id ?? null;
  const exElegido = elegido && listaEj.find(e => e.id === elegido.id);
  const sigueValido = exElegido && (elegido.completo || !estaCompleto(exElegido, dayProg));
  const activoId = sigueValido ? elegido.id : pendiente;
  const exActivo = listaEj.find(e => e.id === activoId);
  // En una bi-serie se alterna entre los dos: se abren juntos.
  const bsAbierta = exActivo?.bs && !bsSueltas.includes(exActivo.bs) ? exActivo.bs : null;
  const estaAbierto = (ex) => ex.id === activoId || (bsAbierta && ex.bs === bsAbierta);
  const onAbrir = useCallback((id) => {
    const ex = listaEj.find(e => e.id === id);
    setElegido({ id, completo: !!ex && estaCompleto(ex, dayProg) });
  }, [listaEj, dayProg]);

  // ─── Ajustar / corregir una serie con la rueda ───
  const [hoja, setHoja] = useState(null);             // { exId, i }
  const [ultima, setUltima] = useState(null);         // la última serie dada por hecha
  const onAjustar = useCallback((ex, i) => setHoja({ exId: ex.id, i }), []);
  const onHecha = useCallback((exId, i) => setUltima({ exId, i }), []);
  const datosDe = (ex) => ({
    ultima: ultimaSesion(progresoTotal, ex.id, diaData.fecha),
    sugerencia: sugerirCarga(ex, progresoTotal, { hasta: diaData.fecha, descarga: !!diaData.descarga }),
  });
  const exHoja = hoja && listaEj.find(e => e.id === hoja.exId);
  const exUltima = ultima && listaEj.find(e => e.id === ultima.exId);
  const logUltima = exUltima && dayProg[exUltima.id]?.sets?.[ultima.i] ? dayProg[exUltima.id]?.logs?.[ultima.i] : null;

  // ─── Que el botón de la serie siguiente no quede debajo del descanso ───
  // Al dar una serie por hecha aparece el temporizador abajo. Si tapa el botón
  // «Hecha» de lo que toca ahora (la serie siguiente, o el primer ejercicio
  // siguiente al cerrar uno), se desplaza lo justo para dejarlo a la vista.
  // Solo cuando se acaba de marcar algo: abrir la sesión no mueve nada.
  const seriesMarcadas = listaEj.reduce((a, ex) => a + (dayProg[ex.id]?.sets?.filter(Boolean).length ?? 0), 0);
  const marcadasAntes = useRef(seriesMarcadas);
  useEffect(() => {
    const subio = seriesMarcadas > marcadasAntes.current;
    marcadasAntes.current = seriesMarcadas;
    if (!subio) return;
    const id = requestAnimationFrame(() => {
      const el = document.querySelector('[data-accion-serie]');
      if (!el) return;
      const r = el.getBoundingClientRect();
      const libre = window.innerHeight - 190;          // lo que deja el temporizador
      if (r.bottom > libre) window.scrollBy({ top: r.bottom - libre, behavior: 'smooth' });
      else if (r.top < 90) window.scrollBy({ top: r.top - 90, behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(id);
  }, [seriesMarcadas]);

  let numero = 0;

  return (
    <div className="min-h-screen bg-fondo">
      <header className="sticky top-0 z-30 bg-fondo">
        <div className={`px-4 pt-3 pb-3 ${COLUMNA}`}>
          <div className="flex items-center gap-1">
            <button onClick={onBack} aria-label="Volver al día" className="w-11 h-11 -ml-2 flex items-center justify-center text-tinta2 flex-shrink-0">
              <ArrowLeft size={24} />
            </button>
            <div className="flex-1 min-w-0">
              {/* El nombre abre la ficha de la sesión: es la consulta más frecuente */}
              <button onClick={() => onVerFicha?.(sesionKey)} className="text-left block max-w-full min-h-[32px]">
                <h1 className="text-xl font-semibold text-tinta leading-tight truncate">{ses.nombre}</h1>
              </button>
              <div className="text-sm text-tinta3">
                <span className="font-semibold" style={{ color }}>{GRUPOS[info?.grupo]?.label ?? info?.label}</span>
                {total > 0 && <> · {completed}/{total} ejercicios{done ? ' · completo' : ''}</>}
              </div>
            </div>
            {anyProgress && (
              <button onClick={onReset} className="h-11 px-2 flex items-center gap-1.5 text-sm text-tinta3 flex-shrink-0">
                <RotateCcw size={15} /> Reset
              </button>
            )}
          </div>
          {total > 0 && (
            <div className="mt-2 flex gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={completed} aria-label="Ejercicios completados">
              {listaEj.map(ex => (
                <span key={ex.id} className="h-1 flex-1 rounded-full"
                  style={{ background: estaCompleto(ex, dayProg) ? color : ex.id === activoId ? '#56636d' : '#1f272e' }} />
              ))}
            </div>
          )}
        </div>
      </header>

      <main className={`px-4 pt-2 ${COLUMNA} pb-44`}>
        {/* S4 · con poco sueño la sesión va reducida */}
        {s4?.nivel === 'reducida' && (
          <Detalle className="mb-3" tono="ambar" abiertoInicial icono={<Moon size={18} />} resumen="Hoy, versión reducida">
            {s4.texto}
          </Detalle>
        )}
        {diaData.descarga && (
          <Detalle className="mb-3" icono={<Moon size={18} />} resumen={`Semana ${diaData.semanaBloque} · descarga: mitad de series, RIR +2`}>
            Haces la mitad de las series y dejas 2 repeticiones más en el tanque. No es semana de subir cargas (P4).
          </Detalle>
        )}

        {/* CSS · calculadora en el test, tabla de ritmos en toda sesión de agua */}
        {esAgua && <PanelCSS esTest={sesionKey === 'natCSS'} />}

        {/* Registro de ejercicios que YA NO están en la rutina. No se borra nunca:
            se enseña aparte para que nada desaparezca en silencio. */}
        {huerfanos.length > 0 && (
          <Detalle className="mb-3" abiertoInicial resumen={`${huerfanos.length} ejercicio(s) registrados que ya no están en tu rutina`}>
            {huerfanos.join(', ')}. Se conservan aquí para que el historial no se pierda.
          </Detalle>
        )}

        {/* Aviso de acarreo · reglas E9 + P2 */}
        {listaEj.some(e => e.acarreo) && (
          <Detalle className="mb-3" tono="ambar" icono={<AlertTriangle size={18} />} resumen="Un solo acarreo por sesión (E9)">
            Progresas en <b>carga</b> mientras aguantes 30 m con postura perfecta; en cuanto te inclines, te encorves o
            des pasos raros, bajas el peso (P2). Semanas 1-3: deliberadamente ligero (L1).
          </Detalle>
        )}

        {total === 0 ? (
          <div className="text-center py-16">
            <Moon size={40} className="text-tenue mx-auto mb-3" />
            <h2 className="text-2xl font-semibold text-tinta2 mb-2">Día de descanso</h2>
            <p className="text-base text-tinta3 max-w-xs mx-auto">El sueño es tu factor limitante real. Hoy recuperas. Máximo unos dead hangs suaves si te apetece.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {grupos.map(([parte, ejs]) => (
              <div key={parte} className="space-y-2">
                {PARTES[parte] && mostrarPartes && (
                  <div className="px-1 pt-1">
                    <h2 className="text-sm font-medium text-tinta3">{PARTES[parte].label}</h2>
                  </div>
                )}
                {ejs.map(ex => {
                  numero += 1;
                  const abierta = estaAbierto(ex);
                  // La sugerencia solo se calcula para lo que se ve abierto.
                  const d = abierta ? datosDe(ex) : null;
                  return (
                    <ExerciseCard key={ex.id} ex={ex} numero={numero} prog={dayProg[ex.id]} pr={prMap[ex.id]} color={color}
                      abierta={abierta} onAbrir={onAbrir} onAjustar={onAjustar} onHecha={onHecha}
                      avisoReset={avisosReset[ex.id]}
                      bsSuelta={!!ex.bs && bsSueltas.includes(ex.bs)}
                      ultima={d?.ultima} sugerencia={d?.sugerencia} />
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* Sesión terminada · resumen y qué toca la próxima vez */}
        {done && total > 0 && (
          <div className="mt-5 rounded-3xl bg-tarjeta p-5">
            <div className="flex items-center gap-3">
              <span className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: color + '33', color }}>
                <Check size={24} strokeWidth={2.8} />
              </span>
              <div>
                <h3 className="text-2xl font-semibold text-tinta leading-tight">Sesión completada</h3>
                <p className="text-sm text-tinta3">{total} ejercicios · {listaEj.reduce((a, e) => a + nSeries(e), 0)} series</p>
              </div>
            </div>
            {listaEj.some(e => e.lineal) && (
              <div className="mt-4 pt-4 border-t border-divisor">
                <div className="rotulo mb-1">La próxima vez</div>
                {listaEj.filter(e => e.lineal).map(e => {
                  const s = sugerirCarga(e, progresoTotal, {});
                  return (
                    <div key={e.id} className="flex items-baseline gap-3 py-1.5 text-base">
                      <span className="flex-1 min-w-0 text-tinta2 truncate">{e.nombre}</span>
                      <span className="font-semibold text-tinta">{s?.kg != null ? `${s.kg} kg` : '—'}</span>
                      <span className="w-20 text-right text-sm" style={{ color: s?.tipo === 'subir' ? color : '#8a97a1' }}>
                        {s?.tipo === 'subir' ? 'sube' : s?.tipo === 'reset' ? 'reset' : 'repite'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-sm text-tinta3 mt-3">Buen trabajo. Recupera: proteína + sueño.</p>
            <BotonCTA color={color} className="mt-4" onClick={onBack}>Listo</BotonCTA>
          </div>
        )}

        {onEditarRutina && total > 0 && (
          <button onClick={() => onEditarRutina(sesionKey)}
            className="w-full mt-4 h-12 rounded-2xl border border-borde text-tinta3 text-sm font-medium flex items-center justify-center gap-2">
            <Pencil size={15} /> Editar esta rutina
            {rutinaEditada && <span className="text-ambar">· editada</span>}
          </button>
        )}
      </main>

      <RestTimer timer={restTimer} onSkip={onSkipTimer} color={color}
        guardada={logUltima ? `serie ${ultima.i + 1} guardada · ${textoSerie(logUltima)}` : null}
        onCorregir={logUltima ? () => setHoja(ultima) : null} />

      {exHoja && (() => {
        const d = datosDe(exHoja);
        const marcada = !!dayProg[exHoja.id]?.sets?.[hoja.i];
        const sc = nSeries(exHoja);
        return (
          <HojaSerie ex={exHoja} indice={hoja.i} color={color} marcada={marcada}
            inicial={proponerSerie(exHoja, dayProg[exHoja.id], hoja.i, d.sugerencia, d.ultima)}
            pista={[
              d.sugerencia?.kg != null && `Sugerido ${d.sugerencia.kg} kg`,
              d.ultima && `última vez ${d.ultima.kgMax || '—'} × ${d.ultima.logs.map(l => l.reps ?? '–').join(', ')}`,
            ].filter(Boolean).join(' · ')}
            onGuardar={(log) => { setUltima(hoja); registrarSerie(exHoja.id, hoja.i, sc, exHoja, log); setHoja(null); }}
            onDesmarcar={() => { toggleSet(exHoja.id, hoja.i, sc, exHoja); setHoja(null); }}
            onCerrar={() => setHoja(null)} />
        );
      })()}
    </div>
  );
};

export default SessionView;
