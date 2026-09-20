import React, { useState, useMemo } from 'react';
import { ArrowLeft, Check, AlertTriangle, ChevronLeft, ChevronRight, X, RotateCcw } from 'lucide-react';
import { SESION_INFO, MUSCULOS } from '../../data.js';
import { verificarSesion } from '../../validador.js';
import { catalogoEjercicios, nuevoId, mover, gruposBS, resolverRutina, estaEditada } from '../../rutina.js';
import { usePlanCtx } from '../../estado/contextos.js';
import NumInput from '../comunes/NumInput.jsx';

// ═══════════════ EDITOR DE RUTINA ═══════════════
// Libertad total sobre la sesión, con el verificador informando en vivo.
// NO bloquea: clasifica en duras y blandas y exige un motivo al guardar, que es
// lo que hace útil la revisión de las 8 semanas (N3).
//
// Arranca con la rutina VIGENTE hoy, resuelta desde el contexto. onGuardar,
// onRestaurar y onCerrar vienen de App, que además cierra el editor.
const EditorRutina = ({ sesionKey, onGuardar, onRestaurar, onCerrar }) => {
  const { todayISO, rutina } = usePlanCtx();
  const editada = estaEditada(sesionKey, todayISO, rutina);
  // Copia profunda de la vigente, UNA vez al montar: lo que se edita es local
  // hasta que se guarda.
  const [lista, setLista] = useState(() => JSON.parse(JSON.stringify(resolverRutina(sesionKey, todayISO, rutina))));
  const [motivo, setMotivo] = useState('');
  const [anadiendo, setAnadiendo] = useState(false);
  const [busca, setBusca] = useState('');

  const info = SESION_INFO[sesionKey];
  const res = useMemo(() => verificarSesion(sesionKey, lista), [sesionKey, lista]);
  const catalogo = useMemo(() => catalogoEjercicios(), []);
  const yaEstan = new Set(lista.map(e => e.id));
  const candidatos = catalogo
    .filter(e => !yaEstan.has(e.id))
    .filter(e => !busca || e.nombre.toLowerCase().includes(busca.toLowerCase()));

  // Agrupados por su músculo PRIMARIO principal (el primero de la lista), en el
  // orden en que MUSCULOS los declara: empuje, tracción, pierna, core. Un
  // ejercicio sin músculos va a "Otros". Mismo patrón que el menú de sesiones:
  // cabecera por grupo, desplegable. Cerrados al abrir; al buscar se abren
  // todos, porque lo que quieres ver es la coincidencia.
  const porMusculo = useMemo(() => {
    const g = new Map();
    for (const e of candidatos) {
      const k = Array.isArray(e.musculos?.primario) && e.musculos.primario[0] ? e.musculos.primario[0] : 'otros';
      if (!g.has(k)) g.set(k, []);
      g.get(k).push(e);
    }
    const orden = [...Object.keys(MUSCULOS), 'otros'];
    return [...g.entries()].sort((a, b) => orden.indexOf(a[0]) - orden.indexOf(b[0]));
  }, [candidatos]);
  const [abiertos, setAbiertos] = useState(() => new Set());
  const alternar = (k) => setAbiertos(s => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const desplegado = (k) => !!busca || abiertos.has(k);

  const editar = (i, cambio) => setLista(l => l.map((e, j) => j === i ? { ...e, ...cambio } : e));
  const quitar = (i) => setLista(l => l.filter((_, j) => j !== i));
  const anadir = (ex) => {
    const copia = { ...JSON.parse(JSON.stringify(ex)), parte: 3, bs: undefined };
    delete copia.origen; delete copia.origenNombre;
    if (yaEstan.has(copia.id)) copia.id = nuevoId(sesionKey, lista);
    setLista(l => [...l, copia]);
    setAnadiendo(false); setBusca('');
  };

  const series = lista.filter(e => !e.opcional).reduce((a, e) => a + (typeof e.series === 'number' ? e.series : 0), 0);
  const grupos = gruposBS(lista);

  return (
    <div className="min-h-screen bg-[#0f1417]">
      <header className="sticky top-0 z-30 bg-[#0f1417]/95 backdrop-blur border-b border-[#232c34]">
        <div className="px-4 py-3">
          <button onClick={onCerrar} className="flex items-center gap-1.5 text-slate-400 text-xs font-bold uppercase tracking-wide mb-2">
            <ArrowLeft size={14} /> Salir sin guardar
          </button>
          <h1 className="text-lg font-bold text-slate-50 leading-tight">Editar {info?.label}</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {lista.length} ejercicios · {series} series obligatorias
            {editada && <span className="text-amber-400"> · ya editada respecto al plan</span>}
          </p>
        </div>

        {/* Verificador en vivo */}
        <div className="px-4 pb-3">
          {res.duras.length === 0 && res.blandas.length === 0 ? (
            <div className="px-3 py-2 rounded-lg bg-emerald-950/30 border border-emerald-800/40 flex items-center gap-2">
              <Check size={14} className="text-emerald-400" strokeWidth={3} />
              <span className="text-[11px] text-emerald-300 font-bold">Cumple todas las reglas del plan</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {res.duras.map((d, i) => (
                <div key={'d' + i} className="px-3 py-2 rounded-lg border-l-4 border-red-500 bg-red-950/25 flex items-start gap-2">
                  <AlertTriangle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-red-100 leading-relaxed">
                    <span className="font-bold">{d.regla}.</span> {d.texto}
                  </p>
                </div>
              ))}
              {res.blandas.map((b, i) => (
                <div key={'b' + i} className="px-3 py-2 rounded-lg border-l-4 border-amber-600 bg-amber-950/20 flex items-start gap-2">
                  <AlertTriangle size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-100/90 leading-relaxed">
                    <span className="font-bold">{b.regla}.</span> {b.texto}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="px-3 py-3 max-w-2xl mx-auto pb-32 space-y-2">
        {lista.map((ex, i) => {
          const senalado = [...res.duras, ...res.blandas].some(h => h.ejercicios?.includes(ex.id));
          return (
            <div key={ex.id + i} className={`rounded-lg border bg-[#151b21] p-2.5 ${senalado ? 'border-red-800/60' : 'border-[#232c34]'}`}>
              <div className="flex items-start gap-2">
                <div className="flex flex-col gap-0.5 flex-shrink-0">
                  <button onClick={() => setLista(l => mover(l, i, -1))} disabled={i === 0}
                    aria-label="Subir" className="w-7 h-6 rounded border border-[#2a3540] text-slate-400 disabled:text-slate-700 flex items-center justify-center">
                    <ChevronLeft size={13} className="rotate-90" />
                  </button>
                  <button onClick={() => setLista(l => mover(l, i, 1))} disabled={i === lista.length - 1}
                    aria-label="Bajar" className="w-7 h-6 rounded border border-[#2a3540] text-slate-400 disabled:text-slate-700 flex items-center justify-center">
                    <ChevronRight size={13} className="rotate-90" />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-100 leading-tight">{ex.nombre}</div>
                  <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                    <select value={ex.parte ?? 3} onChange={e => editar(i, { parte: e.target.value === 'finisher' ? 'finisher' : Number(e.target.value) })}
                      aria-label="Parte" className="h-7 px-1 bg-[#0f1417] border border-[#2a3540] text-slate-300 text-[10px] rounded">
                      <option value={1}>Parte 1</option>
                      <option value={2}>Parte 2</option>
                      <option value={3}>Parte 3</option>
                      <option value="finisher">Finisher</option>
                    </select>
                    <select value={ex.bs ?? ''} onChange={e => editar(i, { bs: e.target.value || undefined })}
                      aria-label="Bi-serie" className="h-7 px-1 bg-[#0f1417] border border-[#2a3540] text-slate-300 text-[10px] rounded">
                      {grupos.map(g => <option key={g ?? 'none'} value={g ?? ''}>{g ?? 'Sin bi-serie'}</option>)}
                    </select>
                    <NumInput value={ex.series} onChange={v => editar(i, { series: v === '' ? 0 : parseInt(v, 10) })} placeholder="ser" w="w-11" etiqueta={`Series de ${ex.nombre}`} />
                    <button onClick={() => editar(i, { opcional: !ex.opcional })}
                      className={`h-7 px-2 rounded border text-[10px] font-bold ${ex.opcional ? 'border-slate-500 bg-slate-700/30 text-slate-300' : 'border-[#2a3540] text-slate-500'}`}>
                      {ex.opcional ? 'Opcional *' : 'Obligatorio'}
                    </button>
                    <button onClick={() => quitar(i)} aria-label={`Quitar ${ex.nombre}`}
                      className="h-7 w-7 rounded border border-red-900/50 text-red-400 flex items-center justify-center ml-auto">
                      <X size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Añadir ejercicio */}
        {anadiendo ? (
          <div className="rounded-lg border border-[#232c34] bg-[#151b21] p-2.5">
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar ejercicio…" aria-label="Buscar ejercicio"
              className="w-full h-9 px-2 mb-2 bg-[#0f1417] border border-[#2a3540] focus:border-emerald-600 focus:outline-none text-slate-100 text-xs rounded" />
            <div className="max-h-72 overflow-y-auto space-y-1">
              {porMusculo.map(([k, ejs]) => {
                const m = MUSCULOS[k];
                const label = m?.label ?? 'Otros';
                const color = m?.color ?? '#94a3b8';
                const abierto = desplegado(k);
                return (
                  <div key={k} className="rounded-lg border border-[#2a3540] overflow-hidden">
                    <button onClick={() => alternar(k)}
                      aria-label={`Músculo ${label}`} aria-expanded={abierto}
                      className="w-full px-2.5 py-2 flex items-center gap-2 text-left">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="text-xs font-bold flex-1" style={{ color }}>{label}</span>
                      <span className="text-[10px] text-slate-500">{ejs.length}</span>
                      <ChevronRight size={14} className={`text-slate-500 transition-transform ${abierto ? 'rotate-90' : ''}`} />
                    </button>
                    {abierto && (
                      <div className="space-y-1 p-2 pt-0">
                        {ejs.map(e => (
                          <button key={e.origen + e.id} onClick={() => anadir(e)}
                            className="w-full text-left px-2 py-1.5 rounded border border-[#232c34] hover:border-emerald-700">
                            <div className="text-[12px] text-slate-200">{e.nombre}</div>
                            <div className="text-[9px] text-slate-600">{SESION_INFO[e.origen]?.label ?? e.origen}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {!candidatos.length && <p className="text-[11px] text-slate-600 py-2 text-center">Nada que coincida.</p>}
            </div>
            <button onClick={() => { setAnadiendo(false); setBusca(''); }}
              className="w-full mt-2 py-1.5 text-[10px] uppercase font-bold text-slate-400">Cancelar</button>
          </div>
        ) : (
          <button onClick={() => setAnadiendo(true)}
            className="w-full py-2.5 rounded-lg border border-dashed border-[#2a3540] text-slate-400 text-[11px] font-bold uppercase">
            + Añadir ejercicio
          </button>
        )}

        <button onClick={onRestaurar}
          className="w-full py-2 rounded-lg border border-amber-800/50 bg-amber-950/20 text-amber-300 text-[10px] font-bold uppercase flex items-center justify-center gap-1.5">
          <RotateCcw size={12} /> Volver al plan original
        </button>
      </main>

      {/* Guardar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0f1417]/95 backdrop-blur border-t border-[#232c34] p-3">
        <div className="max-w-2xl mx-auto space-y-2">
          <input value={motivo} onChange={e => setMotivo(e.target.value)} aria-label="Motivo del cambio"
            placeholder="¿Por qué lo cambias? (se guarda con la versión)"
            className="w-full h-9 px-2 bg-[#151b21] border border-[#2a3540] focus:border-emerald-600 focus:outline-none text-slate-100 text-xs rounded" />
          <div className="flex gap-2">
            <button onClick={onCerrar} className="px-4 py-2.5 border border-[#2a3540] text-slate-300 text-xs font-bold uppercase rounded-lg">Cancelar</button>
            <button onClick={() => onGuardar(lista, motivo)} disabled={!motivo.trim()}
              className={`flex-1 py-2.5 text-white text-xs font-bold uppercase rounded-lg ${
                !motivo.trim() ? 'bg-slate-700 text-slate-500' : res.duras.length ? 'bg-amber-700' : 'bg-emerald-600'}`}>
              {!motivo.trim() ? 'Escribe el motivo' : res.duras.length ? `Guardar con ${res.duras.length} aviso(s)` : 'Guardar'}
            </button>
          </div>
          <p className="text-[9px] text-slate-600 leading-relaxed">
            Se guarda como versión de hoy. Las sesiones que ya entrenaste conservan los ejercicios que hiciste.
          </p>
        </div>
      </div>
    </div>
  );
};

export default EditorRutina;
