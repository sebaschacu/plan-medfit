import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MUSCULOS, CAT_MUSCULO, RANGO_VOLUMEN } from '../../data.js';
import { resolverRutina } from '../../rutina.js';
import { mesDeISO } from '../../utiles/formato.js';

// ═══════════════ VOLUMEN POR GRUPO MUSCULAR (v6 · 7.2) ═══════════════
// Series efectivas = (series × 1.0 si primario) + (series × 0.5 si secundario).
// Los secundarios a mitad es la convención de la literatura de volumen: contarlos
// enteros infla el dorsal y los erectores, que aparecen en casi todo.
// Ventana SEMANAL, porque la franja objetivo (8-12 series por grupo) es semanal.
const VolumenMuscular = ({ calendario, progress, todayISO, rutina = {} }) => {
  // Semanas lunes→domingo, derivadas del campo `sem` para respetar las ediciones manuales.
  const semanas = useMemo(() => {
    const out = []; let cur = [];
    calendario.forEach(d => {
      cur.push(d);
      if (d.sem === 'Dom') { out.push(cur); cur = []; }
    });
    if (cur.length) out.push(cur);
    return out;
  }, [calendario]);

  // Si hoy no cae en el mes que se está mirando, se abre por la primera semana
  // (no por la última) y NO se etiqueta ninguna como "semana actual".
  const semanaDeHoy = useMemo(
    () => semanas.findIndex(s => s.some(d => d.fecha === todayISO)),
    [semanas, todayISO]
  );
  const semanaInicial = semanaDeHoy === -1 ? 0 : semanaDeHoy;

  const [idx, setIdx] = useState(semanaInicial);
  const [cat, setCat] = useState('todos');
  // Al cambiar de mes hay que volver a la semana inicial. Hacerlo con un useEffect
  // que llama a setIdx pinta primero la semana vieja y luego corrige: un render de
  // más con datos equivocados. El ajuste durante el render es el patrón que React
  // documenta para esto — descarta el render en curso y rehace sin llegar a pintar.
  // Se compara el MES, no el índice: dos meses distintos pueden compartir índice
  // inicial (0 en ambos) y entonces no se resetearía la semana elegida.
  const mesActual = calendario[0]?.fecha.slice(0, 7) ?? '';
  const [mesVisto, setMesVisto] = useState(mesActual);
  if (mesVisto !== mesActual) {
    setMesVisto(mesActual);
    setIdx(semanaInicial);
  }

  const semana = useMemo(() => semanas[Math.min(idx, semanas.length - 1)] || [], [semanas, idx]);

  const datos = useMemo(() => {
    const plan = {}, hecho = {};
    const add = (acc, m, v) => { acc[m] = (acc[m] || 0) + v; };

    semana.forEach(d => {
      const claves = [
        d.sesion === 'natacion' ? (d.variante ?? 'natacion') : d.sesion,
        d.sesionSecundaria === 'natacion' ? (d.varianteSecundaria ?? 'natacion') : d.sesionSecundaria,
        ...(d.complementos ?? []),
      ].filter(Boolean);
      const pDia = progress[d.fecha] || {};
      claves.flatMap(k => resolverRutina(k, d.fecha, rutina)).forEach(ex => {
        if (!ex.musculos || typeof ex.series !== 'number' || ex.series === 0) return;
        // Planificadas = solo lo no opcional: los `*` son lo primero que se recorta (R2),
        // así que son suelo comprometido, no promesa.
        const sPlan = ex.opcional ? 0 : ex.series;
        const sHecho = pDia[ex.id]?.sets?.filter(Boolean).length || 0;
        ex.musculos.primario.forEach(m => { add(plan, m, sPlan); add(hecho, m, sHecho); });
        ex.musculos.secundario.forEach(m => { add(plan, m, sPlan * 0.5); add(hecho, m, sHecho * 0.5); });
      });
    });

    const filas = Object.keys({ ...plan, ...hecho })
      .filter(m => MUSCULOS[m] && ((plan[m] || 0) > 0 || (hecho[m] || 0) > 0))
      .filter(m => cat === 'todos' || MUSCULOS[m].cat === cat)
      .map(m => ({ m, ...MUSCULOS[m], plan: +(plan[m] || 0).toFixed(1), hecho: +(hecho[m] || 0).toFixed(1) }))
      .sort((a, b) => b.plan - a.plan || b.hecho - a.hecho);

    // Escala FIJA (2× el tope de la franja objetivo). Si fuera adaptativa, la franja
    // 8-12 se movería de semana a semana y se perdería la lectura de un vistazo.
    // Lo que se salga se recorta visualmente; el número y el ▲ dicen cuánto es.
    const escala = RANGO_VOLUMEN.objetivoMax * 2;
    return { filas, escala };
  }, [semana, progress, cat, rutina]);

  const rango = (v) => v === 0 ? 'cero' : v < RANGO_VOLUMEN.min ? 'bajo' : v > RANGO_VOLUMEN.max ? 'alto' : 'ok';
  const colorRango = { cero: '#475569', bajo: '#f59e0b', alto: '#f59e0b', ok: '#94a3b8' };

  const dias = semana.map(d => d.dia);
  const etiqueta = dias.length
    ? (dias.length === 1 ? `Día ${dias[0]}` : `${dias[0]} – ${dias[dias.length - 1]} de ${mesDeISO(semana[0].fecha)}`)
    : '—';

  return (
    <div className="rounded-xl border border-[#232c34] bg-[#151b21] p-3.5 mt-2.5">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">Volumen por grupo muscular</div>
        <div className="flex items-center gap-1">
          <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}
            aria-label="Semana anterior"
            className="w-6 h-6 rounded flex items-center justify-center text-slate-400 disabled:text-slate-700 border border-[#232c34]">
            <ChevronLeft size={13} />
          </button>
          <button onClick={() => setIdx(i => Math.min(semanas.length - 1, i + 1))} disabled={idx >= semanas.length - 1}
            aria-label="Semana siguiente"
            className="w-6 h-6 rounded flex items-center justify-center text-slate-400 disabled:text-slate-700 border border-[#232c34]">
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
      <div className="text-[11px] text-slate-400 font-medium mb-3">
        {etiqueta}
        {idx === semanaDeHoy && semanaDeHoy !== -1 && <span className="ml-1.5 text-[9px] uppercase tracking-wide text-slate-500">· semana actual</span>}
      </div>

      {/* Filtro por categoría */}
      <div className="flex gap-1 mb-3 flex-wrap">
        {[['todos', 'Todos', '#94a3b8'], ...Object.entries(CAT_MUSCULO).map(([k, v]) => [k, v.label, v.color])].map(([k, label, c]) => (
          <button key={k} onClick={() => setCat(k)}
            className={`text-[9px] font-bold uppercase tracking-wide px-2 py-1 rounded border transition-all ${cat === k ? '' : 'border-[#232c34] text-slate-500'}`}
            style={cat === k ? { background: c + '22', borderColor: c + '88', color: c } : undefined}>
            {label}
          </button>
        ))}
      </div>

      {datos.filas.length === 0 ? (
        <p className="text-[11px] text-slate-600 py-3 text-center">Sin volumen registrado ni planificado en esta semana.</p>
      ) : (
        <>
          <div className="space-y-2">
            {datos.filas.map(f => {
              const wPlan = Math.min(100, (f.plan / datos.escala) * 100);
              const wHecho = Math.min(100, (f.hecho / datos.escala) * 100);
              const r = rango(f.plan);
              const excede = f.plan > datos.escala;
              return (
                <div key={f.m}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[11px] font-medium text-slate-300">{f.label}</span>
                    <span className="text-[10px] font-bold" style={{ fontFamily: 'ui-monospace, monospace' }}>
                      <span style={{ color: f.hecho > 0 ? f.color : '#475569' }}>{f.hecho}</span>
                      <span className="text-slate-600"> / {f.plan}</span>
                      {(r === 'bajo' || r === 'alto') && (
                        <span className="ml-1" style={{ color: colorRango[r] }}>{r === 'bajo' ? '▼' : '▲'}</span>
                      )}
                    </span>
                  </div>
                  <div className="relative h-2 bg-[#0f1417] rounded-full overflow-hidden">
                    {/* Franja objetivo 8-12, al fondo */}
                    <div className="absolute inset-y-0 pointer-events-none"
                      style={{
                        left: `${(RANGO_VOLUMEN.objetivoMin / datos.escala) * 100}%`,
                        width: `${((RANGO_VOLUMEN.objetivoMax - RANGO_VOLUMEN.objetivoMin) / datos.escala) * 100}%`,
                        background: 'rgba(226,232,240,0.10)',
                        boxShadow: 'inset 1px 0 0 rgba(226,232,240,0.30), inset -1px 0 0 rgba(226,232,240,0.30)',
                      }} />
                    {/* Planificado (translúcido) */}
                    <div className="absolute inset-y-0 left-0" style={{ width: `${wPlan}%`, background: f.color, opacity: 0.25 }} />
                    {/* Hecho (sólido) */}
                    <div className="absolute inset-y-0 left-0" style={{ width: `${wHecho}%`, background: f.color, transition: 'width 0.6s ease' }} />
                    {/* Marca de recorte: el volumen se sale de la escala */}
                    {excede && <div className="absolute inset-y-0 right-0 w-1" style={{ background: colorRango.alto }} />}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 pt-2.5 border-t border-[#232c34] space-y-1">
            <p className="text-[9px] text-slate-600 leading-relaxed">
              Series efectivas: primario ×1 · secundario ×0.5. Sólido = hechas · translúcido = planificadas (sin contar los <span className="font-bold">*</span>).
            </p>
            <p className="text-[9px] text-slate-600 leading-relaxed">
              La banda clara marca la franja productiva de {RANGO_VOLUMEN.objetivoMin}-{RANGO_VOLUMEN.objetivoMax} series/semana para tu nivel.
              ▼ por debajo de {RANGO_VOLUMEN.min} · ▲ por encima de {RANGO_VOLUMEN.max}. La escala llega a {RANGO_VOLUMEN.objetivoMax * 2}: lo que se pase se recorta con una marca ámbar a la derecha.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default VolumenMuscular;
