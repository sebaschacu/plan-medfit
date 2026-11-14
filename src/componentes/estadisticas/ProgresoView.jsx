import React, { useState, useMemo } from 'react';
import { ChevronDown, TrendingUp } from 'lucide-react';
import { SESIONES, SESION_INFO, DOBLES } from '../../data.js';
import { historialEjercicio, mmss } from '../../reglas.js';
import { resolverRutina } from '../../rutina.js';
import { COLUMNA } from '../../utiles/constantes-ui.js';
import { contarRender } from '../../utiles/medir.js';
import { usePlanCtx, useProgresoCtx } from '../../estado/contextos.js';
import { Punto } from '../comunes/ui.jsx';
import VolumenMuscular from './VolumenMuscular.jsx';

// ═══════════════ PROGRESO ═══════════════
// Responde primero a la única pregunta que importa —¿estoy subiendo?— y debajo
// pone los números que la sostienen: los compuestos, el bloque, la semana.

// Los compuestos de progresión lineal, en el orden del plan. Un mismo ejercicio
// puede estar en dos sesiones con ids distintos (el press banca va en Empuje y
// en Torso): se juntan por nombre y su historial suma los dos.
const LINEALES = (() => {
  const porNombre = new Map();
  Object.entries(SESIONES).forEach(([k, ses]) => (ses.ejercicios ?? []).forEach(ex => {
    if (!ex.lineal) return;
    const n = porNombre.get(ex.nombre);
    if (n) { if (!n.ids.includes(ex.id)) n.ids.push(ex.id); return; }
    porNombre.set(ex.nombre, { ex, ids: [ex.id], color: SESION_INFO[k]?.color ?? '#e8edf0' });
  }));
  return [...porNombre.values()];
})();
const VISIBLES = 5;
const lunesDe = (f) => { const d = new Date(f + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };

// Línea en escalones: la carga se mantiene hasta que sube. Así se lee la
// progresión lineal tal cual es, sin pendientes inventadas entre sesiones.
const pathEscalones = (valores, W, H, P) => {
  if (!valores.length) return '';
  const max = Math.max(...valores), min = Math.min(...valores);
  const r = max - min || 1;
  const x = (i) => P + (i / Math.max(1, valores.length - 1)) * (W - P * 2);
  const y = (v) => H - P - ((v - min) / r) * (H - P * 2);
  let d = `M${x(0)},${y(valores[0])}`;
  for (let i = 1; i < valores.length; i++) d += ` H${x(i)} V${y(valores[i])}`;
  return d;
};

const FilaEjercicio = ({ ex, color, hist, abierta, onAbrir }) => {
  const valores = hist.map(h => h.kgMax);
  const primero = valores[0], ultimo = valores.at(-1);
  const delta = valores.length > 1 ? ultimo - primero : 0;
  return (
    <div>
      <button onClick={onAbrir} aria-expanded={abierta}
        className="w-full min-h-[64px] py-2.5 flex items-center gap-3 text-left">
        <Punto color={color} />
        <span className="flex-1 min-w-0">
          <span className="block text-base text-tinta leading-snug">{ex.nombre}</span>
          <span className="block text-sm text-tinta3">
            {hist.length ? `${hist.length} ${hist.length === 1 ? 'sesión' : 'sesiones'}` : 'Sin registros todavía'}
            {delta > 0 && <span style={{ color }}> · +{delta} kg</span>}
          </span>
        </span>
        {valores.length > 1 && (
          <svg width="56" height="28" viewBox="0 0 56 28" aria-hidden="true" className="flex-shrink-0">
            <path d={pathEscalones(valores, 56, 28, 3)} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
          </svg>
        )}
        <span className="w-16 text-right flex-shrink-0">
          {ultimo != null ? <><span className="text-xl font-semibold text-tinta">{ultimo}</span> <span className="text-sm text-tinta3">kg</span></> : <span className="text-tinta3">—</span>}
        </span>
        <ChevronDown size={18} className={`text-mudo flex-shrink-0 transition-transform ${abierta ? 'rotate-180' : ''}`} />
      </button>
      {abierta && (
        <div className="pb-4">
          {valores.length > 1 ? (
            <>
              <svg viewBox="0 0 300 120" className="w-full" style={{ height: 120 }} role="img" aria-label={`Progresión de ${ex.nombre}`}>
                <line x1="8" y1="112" x2="292" y2="112" stroke="#1f272e" strokeWidth="1" />
                <path d={pathEscalones(valores, 300, 120, 8)} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
              </svg>
              <div className="flex justify-between text-sm text-tinta3 mt-1">
                <span>{hist[0].fecha.slice(8)}/{hist[0].fecha.slice(5, 7)} · {primero} kg</span>
                <span>{hist.at(-1).fecha.slice(8)}/{hist.at(-1).fecha.slice(5, 7)} · <b className="text-tinta">{ultimo} kg</b></span>
              </div>
            </>
          ) : (
            <p className="text-sm text-tinta3">
              {hist.length ? `Una sesión: ${ultimo} kg × ${hist[0].logs.map(l => l.reps ?? '–').join(', ')}. La curva aparece al repetirlo.` : 'La curva aparece en cuanto lo registres dos veces.'}
            </p>
          )}
          <p className="text-sm text-tinta3 mt-2">{ex.series} × {ex.reps} · lineal {ex.progresion}</p>
        </div>
      )}
    </div>
  );
};

const ProgresoView = () => {
  contarRender('ProgresoView');
  const { calendario, todayISO, css, rutina, planCfg } = usePlanCtx();
  const { progress } = useProgresoCtx();
  const [abierto, setAbierto] = useState(null);
  const [verVolumen, setVerVolumen] = useState(false);

  const lifts = useMemo(() => LINEALES
    .map(l => ({ ...l, hist: l.ids.flatMap(id => historialEjercicio(progress, id)).sort((a, b) => a.fecha.localeCompare(b.fecha)) }))
    // Primero los que ya tienen registros; dentro de cada grupo, el orden del plan.
    .sort((a, b) => (b.hist.length > 0) - (a.hist.length > 0)), [progress]);
  const [todos, setTodos] = useState(false);
  const visibles = todos ? lifts : lifts.slice(0, VISIBLES);
  const conDatos = lifts.filter(l => l.hist.length > 1);
  const suben = conDatos.filter(l => l.hist.at(-1).kgMax > l.hist[0].kgMax).length;
  const titular = !conDatos.length
    ? 'Aún sin datos'
    : suben === conDatos.length ? 'Sí, estás subiendo' : suben > 0 ? 'Subiendo en parte' : 'Toca revisar';
  const detalle = !conDatos.length
    ? 'La respuesta aparece cuando repitas un ejercicio.'
    : `${suben} de ${conDatos.length} ejercicios principales han subido de carga.`;

  // ─── Semana y bloque de hoy ───
  const hoy = calendario.find(d => d.fecha === todayISO) ?? calendario[0];
  const semanaBloque = hoy?.semanaBloque ?? null;
  const semana = useMemo(() => (hoy ? calendario.filter(d => lunesDe(d.fecha) === lunesDe(hoy.fecha)) : []), [calendario, hoy]);
  const cupo = useMemo(() => {
    const hecha = (fecha, clave) => {
      const ejs = resolverRutina(clave, fecha, rutina);
      const p = progress[fecha] || {};
      return ejs.length > 0 && ejs.every(ex => { const sc = typeof ex.series === 'number' ? ex.series : 1; return sc > 0 && p[ex.id]?.sets?.length === sc && p[ex.id].sets.every(Boolean); });
    };
    const grupo = (k) => (String(k).startsWith('gym') ? 'gym' : String(k).startsWith('nat') ? 'natacion' : k === 'running' || k === 'ciclismo' ? 'cardio' : SESION_INFO[k]?.deporte ? k : null);
    const c = { gym: [0, 0], natacion: [0, 0], cardio: [0, 0], flexible: [0, 0] };
    planCfg.deportesAuto.forEach(dp => { c[dp.clave] = [0, 0]; });
    semana.forEach(d => {
      const claves = [
        [d.sesion === 'natacion' ? (d.variante ?? 'natacion') : d.sesion, d.flexible],
        [d.sesionSecundaria === 'natacion' ? (d.varianteSecundaria ?? 'natacion') : d.sesionSecundaria, false],
      ];
      claves.forEach(([k, flex]) => {
        if (!k) return;
        const g = flex ? 'flexible' : grupo(k);
        if (!g || !c[g]) return;
        c[g][1]++;
        if (k !== 'descanso' && hecha(d.fecha, k)) c[g][0]++;
      });
    });
    return [
      // El objetivo es el cupo de la semana: el del plan o el de Ajustes
      ['Gym', c.gym[0], Math.max(c.gym[1], planCfg.cupo.gym), '#22c55e'],
      ['Natación', c.natacion[0], Math.max(c.natacion[1], planCfg.cupo.natacion), '#06b6d4'],
      ['Running o bici', c.cardio[0], Math.max(c.cardio[1], planCfg.cupo.running), '#0891b2'],
      ...(planCfg.cupo.flexible ? [['Flexible', c.flexible[0], Math.max(c.flexible[1], planCfg.cupo.flexible), '#8a97a1']] : []),
      ...planCfg.deportesAuto.map(dp => [dp.nombre, c[dp.clave][0], Math.max(c[dp.clave][1], dp.porSemana), dp.color]),
    ].filter(([, , t]) => t > 0);
  }, [semana, progress, rutina, planCfg]);

  return (
    <div className="min-h-screen bg-fondo">
      <header className={`px-5 pt-5 pb-3 ${COLUMNA}`}>
        <h1 className="text-[30px] leading-9 font-semibold tracking-[-0.02em] text-tinta">Progreso</h1>
      </header>

      <main className={`px-4 ${COLUMNA} pb-28 space-y-3`}>
        {/* ─── La pregunta ─── */}
        <section className="rounded-3xl bg-tarjeta p-5">
          <div className="rotulo">¿Estás subiendo?</div>
          <div className="flex items-center gap-2.5 mt-1.5">
            {conDatos.length > 0 && suben > 0 && <TrendingUp size={26} className="text-emerald-400 flex-shrink-0" />}
            <h2 className="text-[26px] leading-8 font-semibold text-tinta">{titular}</h2>
          </div>
          <p className="text-[15px] text-tinta2 mt-1">{detalle}</p>

          <div className="mt-3 divide-y divide-divisor">
            {visibles.map(l => (
              <FilaEjercicio key={l.ex.id} ex={l.ex} color={l.color} hist={l.hist}
                abierta={abierto === l.ex.id} onAbrir={() => setAbierto(abierto === l.ex.id ? null : l.ex.id)} />
            ))}
          </div>
          {lifts.length > VISIBLES && (
            <button onClick={() => setTodos(t => !t)} aria-expanded={todos}
              className="w-full h-12 mt-1 rounded-2xl bg-elevada text-[15px] font-medium text-tinta2">
              {todos ? 'Ver menos' : `Ver los ${lifts.length} ejercicios principales`}
            </button>
          )}
        </section>

        {/* ─── Bloque de 8 semanas ─── */}
        {semanaBloque != null && (
          <section className="rounded-3xl bg-tarjeta p-5">
            <div className="flex items-baseline gap-2">
              <div className="rotulo flex-1">Bloque</div>
              <div className="text-[15px] text-tinta2">Semana <b className="text-tinta">{semanaBloque}</b> de {DOBLES.semanasBloque}</div>
            </div>
            <div className="flex gap-1 mt-3" aria-hidden="true">
              {Array.from({ length: DOBLES.semanasBloque }).map((_, i) => (
                <span key={i} className="h-2 flex-1 rounded-full"
                  style={{ background: i + 1 < semanaBloque ? '#4ade80' : i + 1 === semanaBloque ? '#e8edf0' : '#1f272e' }} />
              ))}
            </div>
            <p className="text-sm text-tinta3 mt-2">
              {semanaBloque === DOBLES.semanasBloque ? 'Esta semana es de descarga: mitad de series, RIR +2.' : `La semana ${DOBLES.semanasBloque} es de descarga.`}
            </p>
          </section>
        )}

        {/* ─── Natación ─── */}
        <section className="rounded-3xl bg-tarjeta p-5 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="rotulo">Natación · CSS</div>
            <p className="text-sm text-tinta3 mt-1">{css != null ? 'Bajar es mejorar. Repite el test cada 6-8 semanas.' : 'Haz el Test CSS para tener tus ritmos.'}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <span className="text-[32px] font-semibold text-tinta leading-none">{css != null ? mmss(css) : '—'}</span>
            <span className="block text-sm text-tinta3">/ 100 m</span>
          </div>
        </section>

        {/* ─── Esta semana ─── */}
        <section className="rounded-3xl bg-tarjeta p-5">
          <div className="rotulo mb-2">Esta semana</div>
          <div className="space-y-2.5">
            {cupo.map(([label, h, t, c]) => (
              <div key={label} className="flex items-center gap-3">
                <span className="w-32 text-[15px] text-tinta2 truncate">{label}</span>
                <span className="flex-1 flex gap-1" aria-hidden="true">
                  {Array.from({ length: t }).map((_, i) => (
                    <span key={i} className="h-2 flex-1 rounded-full" style={{ background: i < h ? c : '#1f272e' }} />
                  ))}
                </span>
                <span className="w-10 text-right text-[15px] font-semibold text-tinta">{h}/{t}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Volumen por músculo ─── */}
        <section className="rounded-3xl bg-tarjeta">
          <button onClick={() => setVerVolumen(v => !v)} aria-expanded={verVolumen}
            className="w-full min-h-[60px] px-5 flex items-center gap-3 text-left">
            <span className="flex-1">
              <span className="block text-[17px] font-medium text-tinta">Volumen por músculo</span>
              <span className="block text-sm text-tinta3">Series por semana frente a la franja 8–12</span>
            </span>
            <ChevronDown size={20} className={`text-mudo transition-transform ${verVolumen ? 'rotate-180' : ''}`} />
          </button>
          {verVolumen && <div className="px-2 pb-2"><VolumenMuscular /></div>}
        </section>
      </main>
    </div>
  );
};

export default ProgresoView;
