import React from 'react';
import { Check, Trophy, AlertTriangle, SlidersHorizontal, ChevronDown, ArrowLeftRight } from 'lucide-react';
import { PALAS_MAX_M, E11 } from '../../data.js';
import { useAccionesCtx } from '../../estado/contextos.js';
import { anotaCarga, proponerSerie, textoSerie, serieQueToca } from '../../utiles/serie.js';
import NumInput from '../comunes/NumInput.jsx';
import Musculos from '../comunes/Musculos.jsx';
import { Detalle } from '../comunes/ui.jsx';

// ═══════════════ TARJETA DE EJERCICIO ═══════════════
// Dos tamaños. Plegada es una fila: número, nombre y lo que toca. Abierta es
// la que se usa de pie en el gimnasio, y tiene UNA cosa grande —la carga y las
// reps de la serie que toca— y UN botón grande: «Hecha».
//
// El texto técnico (nota, RIR, descanso, motivo de la sugerencia) no se pierde:
// queda plegado en una línea que se abre al tocar.

const Etiqueta = ({ children, tono = 'neutro' }) => (
  <span className={`inline-flex items-center gap-1 h-6 px-2 rounded-lg text-xs font-semibold flex-shrink-0 ${
    tono === 'ambar' ? 'text-ambar' : 'bg-elevada text-tinta2'}`}
    style={tono === 'ambar' ? { background: 'rgba(245,158,11,0.10)' } : undefined}>
    {children}
  </span>
);

const ExerciseCard = ({ ex, numero, prog, pr, color, avisoReset, ultima, sugerencia, bsSuelta = false, abierta, onAbrir, onAjustar, onHecha, onCambiar }) => {
  const { toggleSet, registrarSerie, onLastre, onBanda, toggleBiserieSuelta } = useAccionesCtx();
  const setCount = typeof ex.series === 'number' ? ex.series : 1;
  const p = prog || { sets: [], logs: [], lastre: null };
  const hechas = (p.sets ?? []).filter(Boolean).length;
  const allDone = setCount > 0 && p.sets?.length === setCount && p.sets.every(Boolean);
  const conCarga = anotaCarga(ex);
  const toca = serieQueToca(p, setCount);
  const propuesta = conCarga && toca >= 0 ? proponerSerie(ex, p, toca, sugerencia, ultima) : null;
  const textoPropuesta = textoSerie(propuesta);
  const num = String(numero).padStart(2, '0');
  const nombreBS = ex.bs ? `${ex.bs} · ${bsSuelta ? 'hoy sueltos' : (ex.bstipo === 'ant' ? 'antagonistas' : 'no compiten')}` : null;

  const hecha = (i) => {
    onHecha?.(ex.id, i);
    if (!conCarga) return toggleSet(ex.id, i, setCount, ex);
    const prop = proponerSerie(ex, p, i, sugerencia, ultima);
    registrarSerie(ex.id, i, setCount, ex, (prop.kg != null || prop.reps != null) ? prop : null);
  };
  // Tocar una casilla: sin marcar, la da por hecha; marcada, la corrige (o, si
  // el ejercicio no anota carga, la desmarca).
  const alTocarCasilla = (i) => {
    if (!p.sets?.[i]) return hecha(i);
    if (conCarga) return onAjustar(ex, i);
    toggleSet(ex.id, i, setCount, ex);
  };

  // ─── Plegada ───
  if (!abierta) {
    return (
      <div data-ejercicio={ex.id} className="relative min-h-[64px] px-4 py-3 rounded-[18px] bg-tarjeta flex items-center gap-3.5">
        <span className="w-6 text-sm text-mudo flex-shrink-0">{allDone ? <Check size={18} strokeWidth={2.6} style={{ color }} /> : num}</span>
        <div className="flex-1 min-w-0">
          <h3 className={`text-[17px] font-medium leading-snug ${allDone ? 'text-tinta3' : 'text-tinta'}`}>
            {/* El botón es el nombre, pero su zona de toque es la fila entera. */}
            <button onClick={() => onAbrir(ex.id)} aria-expanded="false" data-fila
              className="text-left after:absolute after:inset-0 after:rounded-[18px]">{ex.nombre}</button>
          </h3>
          <p className="text-sm text-tinta3 truncate">
            {ex.series} × {ex.reps}{hechas > 0 && !allDone ? ` · ${hechas} de ${setCount} hechas` : ''}{allDone ? ' · hecho' : ''}
          </p>
        </div>
        {ex.bs && <Etiqueta>{ex.bs}</Etiqueta>}
        {ex.opcional && <Etiqueta>Opcional</Etiqueta>}
        {ex.nuevo && !ex.bs && !ex.opcional && <Etiqueta>Nuevo</Etiqueta>}
        <ChevronDown size={18} className="text-mudo flex-shrink-0" aria-hidden="true" />
      </div>
    );
  }

  // ─── Abierta ───
  const lineaPista = [
    sugerencia?.tipo === 'subir' && 'sube',
    sugerencia?.tipo === 'reset' && 'reset del 10 %',
  ].filter(Boolean)[0];

  return (
    <div data-ejercicio={ex.id} data-abierto className="rounded-3xl bg-tarjeta p-5">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="text-sm text-mudo">{num}</span>
            {ex.nuevo && <Etiqueta>Nuevo</Etiqueta>}
            {ex.opcional && <Etiqueta>Opcional</Etiqueta>}
            {ex.bs && <Etiqueta>{nombreBS}</Etiqueta>}
            {allDone && <Etiqueta><Check size={12} strokeWidth={3} />Hecho</Etiqueta>}
            {ex.cambioHoy && <Etiqueta>Solo hoy</Etiqueta>}
            {/* Alternativa con otro equipo. Solo antes de la primera serie: después,
                los kilos ya registrados son de este ejercicio. */}
            {onCambiar && hechas === 0 && (
              <button onClick={() => onCambiar(ex)} aria-label={`Cambiar ${ex.nombre}`}
                className="ml-auto h-8 -my-1 -mr-1.5 px-2.5 rounded-xl flex items-center gap-1.5 text-sm text-tinta3">
                <ArrowLeftRight size={15} /> Cambiar
              </button>
            )}
            {(ex.lastre || ex.acarreo) && pr?.kg != null && (
              <Etiqueta tono="ambar"><Trophy size={12} />Récord {pr.kg} kg{pr.flash ? ' · nuevo' : ''}</Etiqueta>
            )}
          </div>
          <h3 className="text-2xl font-semibold text-tinta leading-tight tracking-[-0.01em]">{ex.nombre}</h3>
          <Musculos musculos={ex.musculos} className="mt-1" />
        </div>
      </div>

      {/* E11 · hoy la pareja puede ir suelta. Alterna los DOS ejercicios de la bi-serie. */}
      {ex.bs && (
        <button onClick={() => toggleBiserieSuelta(ex.bs)}
          aria-label={bsSuelta ? `Volver a emparejar ${ex.bs}` : `Hacer ${ex.bs} por separado hoy`}
          aria-pressed={bsSuelta} title={E11.texto}
          className={`mt-3 h-11 px-3.5 rounded-xl text-sm font-medium ${bsSuelta ? 'bg-elevada text-tinta' : 'border border-borde text-tinta3'}`}>
          {bsSuelta ? 'Emparejar' : E11.label}
        </button>
      )}

      {/* Texto técnico, plegado */}
      <Detalle className="mt-3" resumen={ex.nota || `${ex.series} × ${ex.reps} · descanso ${ex.descanso}`}>
        {ex.nota && <p>{ex.nota}</p>}
        <p className="mt-1 text-tinta3">
          {ex.series} series × {ex.reps} · {ex.lineal ? `lineal ${ex.progresion}` : `RIR ${ex.rir ?? '—'}`} · descanso {ex.descanso}
        </p>
        {sugerencia?.motivo && <p className="mt-1 text-tinta3">{sugerencia.motivo}</p>}
      </Detalle>

      {/* Aviso de reset · regla P6 */}
      {avisoReset && (
        <Detalle className="mt-2" tono="ambar" abiertoInicial icono={<AlertTriangle size={18} />} resumen="Toca reset (P6)">
          Fallaste el objetivo de {avisoReset.objetivo} reps dos sesiones seguidas ({avisoReset.conseguido.join(' y ')} reps).
          {avisoReset.sugerido != null && (
            <> Baja de <b>{avisoReset.actual} kg</b> a <b>{avisoReset.sugerido} kg</b> y vuelve a subir desde ahí.</>
          )}
        </Detalle>
      )}

      {/* Palas · límite por carga de hombro */}
      {ex.palas && (
        <Detalle className="mt-2" tono="ambar" icono={<AlertTriangle size={18} />} resumen={`Máximo ${PALAS_MAX_M} m de palas por sesión`}>
          Con tus series de press y tirón el hombro ya va cargado y las palas multiplican la fuerza sobre el manguito.
          Si aparece molestia, lo primero que sale son las palas — nunca el face pull, que es lo que protege.
        </Detalle>
      )}

      {/* Registros que no son kg × reps */}
      {ex.banda && (
        <label className="mt-3 flex items-center gap-3">
          <span className="text-sm text-tinta3 w-20">Banda</span>
          <input type="text" value={p.banda ?? ''} onChange={(e) => onBanda(ex.id, e.target.value)}
            placeholder="color/nivel" aria-label="Banda de asistencia"
            className="flex-1 min-w-0 h-11 px-3 bg-fondo border border-borde focus:border-tinta3 focus:outline-none text-tinta text-base rounded-xl placeholder:text-mudo" />
        </label>
      )}
      {ex.acarreo && (
        <div className="mt-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-sm text-tinta3 w-20">Acarreo</span>
            <input type="text" inputMode="numeric" value={p.banda ?? ''}
              onChange={(e) => onBanda(ex.id, e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="m" aria-label="Metros"
              className="w-16 h-11 px-1 bg-fondo border border-borde focus:border-tinta3 focus:outline-none text-tinta text-base text-center rounded-xl placeholder:text-mudo" />
            <span className="text-sm text-tinta3">m</span>
            <NumInput value={p.lastre} onChange={(v) => onLastre(ex.id, v === '' ? null : parseFloat(v))} placeholder="kg" />
            <span className="text-sm text-tinta3">kg</span>
          </div>
          <p className="text-sm text-mudo mt-1.5">Sube primero distancia (30→40→50m), luego carga</p>
        </div>
      )}
      {ex.iso && (
        <div className="mt-3">
          <div className="flex items-center gap-2.5">
            <span className="text-sm text-tinta3 w-20">Tiempo</span>
            <NumInput value={p.segundos ?? (ex.lastre ? null : p.lastre)} onChange={(v) => onLastre(ex.id, v === '' ? null : parseFloat(v))} placeholder="seg" />
            <span className="text-sm text-tinta3">seg</span>
          </div>
          <p className="text-sm text-mudo mt-1.5">Anota los segundos y busca superarlos la próxima vez</p>
        </div>
      )}
      {ex.lastre && (
        <div className="mt-3 flex items-center gap-2.5">
          <span className="text-sm text-tinta3 w-20">Lastre</span>
          <NumInput value={p.lastre} onChange={(v) => onLastre(ex.id, v === '' ? null : parseFloat(v))} placeholder="kg" />
          <span className="text-sm text-tinta3">kg</span>
        </div>
      )}

      {setCount > 0 && (
        <div className="mt-4 pt-4 border-t border-divisor">
          <div className="rotulo">{allDone ? `${setCount} series hechas` : `Serie ${toca + 1} de ${setCount}`}</div>

          {/* El dato gigante: lo que toca levantar ahora */}
          {conCarga && !allDone && (
            <>
              <div className="mt-1 flex items-baseline gap-2 text-tinta font-semibold leading-none">
                {propuesta.kg != null ? (
                  <><span className="text-[60px] tracking-[-0.03em]">{propuesta.kg}</span><span className="text-xl text-tinta3 font-medium">kg</span></>
                ) : <span className="text-[40px] text-tinta3">— kg</span>}
                {propuesta.reps != null && (
                  <><span className="text-2xl text-mudo font-normal mx-1">×</span><span className="text-[40px]">{propuesta.reps}</span></>
                )}
              </div>
              <p className="mt-2 text-sm text-tinta3">
                {lineaPista && <span className="font-semibold" style={{ color: sugerencia.tipo === 'reset' ? '#f5b54a' : color }}>{lineaPista} · </span>}
                objetivo {ex.reps}
                {ultima ? ` · última vez ${ultima.kgMax ? ultima.kgMax : '—'} × ${ultima.logs.map(l => l.reps ?? '–').join(', ')}` : ' · primera vez'}
              </p>
            </>
          )}

          {/* Casillas de serie */}
          <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(setCount, 5)}, minmax(0, 1fr))` }}>
            {Array.from({ length: setCount }).map((_, i) => {
              const checked = !!p.sets?.[i];
              const t = checked ? textoSerie(p.logs?.[i]).replace(' × ', '×') : '';
              return (
                <button key={i} onClick={() => alTocarCasilla(i)}
                  aria-label={checked ? `Serie ${i + 1} hecha${t ? `, ${t}` : ''}` : undefined}
                  className={`h-14 rounded-2xl flex flex-col items-center justify-center font-semibold ${checked ? 'text-tinta' : i === toca ? 'text-tinta bg-fondo' : 'text-tinta3 bg-elevada'}`}
                  style={checked ? { background: color + '33', boxShadow: `inset 0 0 0 1.5px ${color}66` } : i === toca ? { boxShadow: `inset 0 0 0 1.5px ${color}` } : undefined}>
                  {checked ? <><Check size={16} strokeWidth={3} style={{ color }} /><span className="text-xs mt-0.5">{t}</span></> : <span className="text-xl">{i + 1}</span>}
                </button>
              );
            })}
          </div>

          {/* Hecha, de un toque. Al lado, ajustar antes de guardar. */}
          {!allDone && (
            <div className="mt-3 flex gap-2.5" data-accion-serie>
              <button onClick={() => hecha(toca)} aria-label={`Hecha la serie ${toca + 1} de ${ex.nombre}${textoPropuesta ? `: ${textoPropuesta}` : ''}`}
                className="flex-1 h-[60px] rounded-[18px] flex items-center justify-center gap-2.5 text-lg font-semibold text-[#0d1215]"
                style={{ background: color }}>
                <Check size={22} strokeWidth={2.8} /> Hecha{textoPropuesta ? ` · ${textoPropuesta}` : ''}
              </button>
              {conCarga && (
                <button onClick={() => onAjustar(ex, toca)} aria-label={`Ajustar la serie ${toca + 1} de ${ex.nombre}`}
                  className="w-[60px] h-[60px] rounded-[18px] bg-elevada flex items-center justify-center text-tinta2 flex-shrink-0">
                  <SlidersHorizontal size={22} />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExerciseCard;
