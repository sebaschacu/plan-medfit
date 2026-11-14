import React, { useState, useMemo } from 'react';
import { ArrowLeft, Check, AlertTriangle, ChevronDown, ChevronRight, X, RotateCcw, ArrowUp, ArrowDown, Minus, Plus, Search } from 'lucide-react';
import { SESION_INFO, MUSCULOS, PARTES } from '../../data.js';
import { verificarSesion } from '../../validador.js';
import { catalogoEjercicios, nuevoId, mover, gruposBS, resolverRutina, estaEditada } from '../../rutina.js';
import { usePlanCtx } from '../../estado/contextos.js';
import { COLUMNA } from '../../utiles/constantes-ui.js';
import Musculos from '../comunes/Musculos.jsx';
import { Punto, Segmentado } from '../comunes/ui.jsx';
import SelectorMusculos from '../comunes/SelectorMusculos.jsx';

// ═══════════════ EDITOR DE RUTINA ═══════════════
// Libertad total sobre la sesión, con el verificador informando en vivo.
// NO bloquea: clasifica en duras y blandas. El motivo es opcional; si se deja
// vacío se guarda "Sin motivo", para que el historial de versiones no tenga
// huecos y la revisión de las 8 semanas (N3) siga sabiendo cuándo cambió qué.
//
// Cada ejercicio es una fila; al tocarla se abre su panel con todo lo que se
// puede cambiar. Solo hay uno abierto a la vez.
//
// Arranca con la rutina VIGENTE hoy, resuelta desde el contexto. onGuardar,
// onRestaurar y onCerrar vienen de App, que además cierra el editor.

const Campo = ({ label, children }) => (
  <div className="flex items-center gap-3 min-h-[52px]">
    <span className="w-24 text-[15px] text-tinta3 flex-shrink-0">{label}</span>
    <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">{children}</div>
  </div>
);

const Opcion = ({ on, onClick, children, label }) => (
  <button onClick={onClick} aria-pressed={on} aria-label={label}
    className={`h-11 px-3 rounded-xl text-[15px] font-medium ${on ? 'bg-tinta text-[#0d1215]' : 'bg-fondo text-tinta2'}`}>
    {children}
  </button>
);

const texto = 'h-11 px-3 bg-fondo border border-borde focus:border-tinta3 focus:outline-none text-tinta text-base rounded-xl placeholder:text-mudo';

// Tipo de progresión que lleva el ejercicio, en las tres variantes del plan.
const progresionDe = (ex) => (ex.lineal ? (/5/.test(String(ex.progresion)) && !/2[.,]5/.test(String(ex.progresion)) ? 'l5' : 'l25') : 'doble');
const PROGRESIONES = [
  ['l25', 'Lineal +2,5', { lineal: true, progresion: '+2.5 kg' }],
  ['l5', 'Lineal +5', { lineal: true, progresion: '+5 kg' }],
  ['doble', 'Doble · RIR', { lineal: false, progresion: undefined }],
];

// Qué se anota al hacer el ejercicio. Son las mismas marcas que ya usa la
// tarjeta de la sesión (acarreo, iso, lineal/RIR): aquí solo se eligen.
const REGISTROS = [['carga', 'kg × reps'], ['iso', 'Segundos'], ['acarreo', 'Metros + kg'], ['marcar', 'Solo marcar']];
const registroDe = (ex) => (ex.acarreo ? 'acarreo' : ex.iso ? 'iso' : (ex.lineal || (ex.rir && ex.rir !== '—')) ? 'carga' : 'marcar');
const cambioDeRegistro = (ex, tipo) => (tipo === 'carga'
  ? { acarreo: undefined, iso: undefined, rir: ex.rir && ex.rir !== '—' ? ex.rir : '1-2' }
  : { acarreo: tipo === 'acarreo' ? true : undefined, iso: tipo === 'iso' ? true : undefined, lineal: false, progresion: undefined, rir: '—' });
const NUEVO = { nombre: '', musculos: { primario: [], secundario: [] }, registro: 'carga', series: 3, reps: '8-12', descanso: '90s' };

const EditorRutina = ({ sesionKey, onGuardar, onRestaurar, onCerrar }) => {
  const { todayISO, rutina } = usePlanCtx();
  const editada = estaEditada(sesionKey, todayISO, rutina);
  // Copia profunda de la vigente, UNA vez al montar: lo que se edita es local
  // hasta que se guarda.
  const [lista, setLista] = useState(() => JSON.parse(JSON.stringify(resolverRutina(sesionKey, todayISO, rutina))));
  const [motivo, setMotivo] = useState('');
  const [anadiendo, setAnadiendo] = useState(false);
  const [busca, setBusca] = useState('');
  const [abierto, setAbierto] = useState(null);       // índice del ejercicio con el panel abierto
  const [modo, setModo] = useState('editar');         // editar | ordenar
  const [nuevo, setNuevo] = useState(null);           // el ejercicio que se está creando desde cero
  const [verMusculos, setVerMusculos] = useState(false);

  const info = SESION_INFO[sesionKey];
  const esGym = String(sesionKey).startsWith('gym');
  const res = useMemo(() => verificarSesion(sesionKey, lista), [sesionKey, lista]);
  const catalogo = useMemo(() => catalogoEjercicios(rutina), [rutina]);
  const yaEstan = new Set(lista.map(e => e.id));
  const candidatos = catalogo
    .filter(e => !yaEstan.has(e.id))
    .filter(e => !busca || e.nombre.toLowerCase().includes(busca.toLowerCase()));

  // Agrupados por su músculo PRIMARIO principal (el primero de la lista), en el
  // orden en que MUSCULOS los declara: empuje, tracción, pierna, core. Un
  // ejercicio sin músculos va a "Otros". Cerrados al abrir; al buscar se abren
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

  const editar = (i, cambio) => setLista(l => l.map((e, j) => {
    if (j !== i) return e;
    const n = { ...e, ...cambio };
    Object.keys(cambio).forEach(k => { if (cambio[k] === undefined) delete n[k]; });
    return n;
  }));
  const quitar = (i) => { setLista(l => l.filter((_, j) => j !== i)); setAbierto(null); };
  // Subir o bajar un ejercicio. Dentro de su parte, cambia de sitio con el vecino.
  // En el borde de la parte no salta por encima de nadie: pasa a la parte de al
  // lado (queda el último de la anterior o el primero de la siguiente), porque
  // la sesión se pinta agrupada por partes y un salto de posición no se vería.
  const subirBajar = (i, d) => {
    const vecino = lista[i + d];
    if (!vecino) return;
    const parteDe = (e) => e.parte ?? 3;
    if (esGym && parteDe(vecino) !== parteDe(lista[i])) { editar(i, { parte: parteDe(vecino) }); return; }
    setLista(l => mover(l, i, d));
    setAbierto(a => (a === i ? i + d : a));
  };
  const anadir = (ex) => {
    const copia = { ...JSON.parse(JSON.stringify(ex)), parte: 3, bs: undefined };
    delete copia.origen; delete copia.origenNombre;
    if (yaEstan.has(copia.id)) copia.id = nuevoId(sesionKey, lista);
    setLista(l => [...l, copia]);
    setAnadiendo(false); setBusca('');
    setAbierto(lista.length);
  };

  // Crear un ejercicio que no está en ninguna lista. Entra al final, abierto,
  // para terminar de ajustarlo (parte, bi-serie, progresión, nota).
  const crear = () => {
    const ex = {
      id: nuevoId(sesionKey, lista), nombre: nuevo.nombre.trim(), parte: 3,
      series: nuevo.series, reps: nuevo.reps, descanso: nuevo.descanso,
      musculos: nuevo.musculos, nuevo: true,
      ...cambioDeRegistro({}, nuevo.registro),
    };
    Object.keys(ex).forEach(k => { if (ex[k] === undefined) delete ex[k]; });
    setLista(l => [...l, ex]);
    setNuevo(null); setAnadiendo(false); setBusca('');
    setAbierto(lista.length);
  };
  const nombreRepetido = nuevo && lista.some(e => e.nombre.toLowerCase() === nuevo.nombre.trim().toLowerCase());
  const puedeCrear = nuevo && nuevo.nombre.trim().length > 1 && nuevo.musculos.primario.length > 0 && !nombreRepetido;

  const series = lista.filter(e => !e.opcional).reduce((a, e) => a + (typeof e.series === 'number' ? e.series : 0), 0);
  const grupos = gruposBS(lista);
  const limpio = res.duras.length === 0 && res.blandas.length === 0;
  let parteAnterior = null;

  return (
    <div className="min-h-screen bg-fondo">
      <header className={`px-4 pt-3 pb-2 ${COLUMNA}`}>
        <button onClick={onCerrar} className="h-11 flex items-center gap-1.5 text-tinta3 text-[15px] font-medium">
          <ArrowLeft size={20} /> Salir sin guardar
        </button>
        <div className="px-1">
          <div className="flex items-center gap-2 text-[15px]"><Punto color={info?.color} /><span className="text-tinta3">Editar rutina</span></div>
          <h1 className="text-[30px] leading-9 font-semibold tracking-[-0.02em] text-tinta mt-1">Editar {info?.label}</h1>
          <p className="text-[15px] text-tinta3 mt-1">
            {lista.length} ejercicios · {series} series obligatorias
            {editada && <span className="text-ambar"> · ya editada respecto al plan</span>}
          </p>
        </div>
      </header>

      <main className={`px-4 ${COLUMNA} pb-72 space-y-3`}>
        {/* Verificador en vivo */}
        {limpio ? (
          <div className="px-4 min-h-[52px] rounded-2xl bg-tarjeta flex items-center gap-2.5">
            <Check size={20} className="text-emerald-400" strokeWidth={3} />
            <span className="text-[15px] text-tinta font-medium">Cumple todas las reglas del plan</span>
          </div>
        ) : (
          <div className="space-y-2">
            {res.duras.map((d, i) => (
              <div key={'d' + i} className="px-4 py-3 rounded-2xl bg-red-950/40 flex items-start gap-2.5">
                <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-[15px] text-red-100 leading-relaxed"><span className="font-semibold">{d.regla}.</span> {d.texto}</p>
              </div>
            ))}
            {res.blandas.map((b, i) => (
              <div key={'b' + i} className="px-4 py-3 rounded-2xl flex items-start gap-2.5" style={{ background: 'rgba(245,158,11,0.10)' }}>
                <AlertTriangle size={18} className="text-ambar flex-shrink-0 mt-0.5" />
                <p className="text-[15px] text-[#f3d9a4] leading-relaxed"><span className="font-semibold">{b.regla}.</span> {b.texto}</p>
              </div>
            ))}
          </div>
        )}

        {/* Editar abre el panel de cada ejercicio; Ordenar pone flechas en cada fila */}
        <Segmentado etiqueta="Qué hacer con la lista" valor={modo} onCambiar={(m) => { setModo(m); setAbierto(null); }}
          opciones={[['editar', 'Editar'], ['ordenar', 'Cambiar el orden']]} />

        <section className="rounded-3xl bg-tarjeta px-4">
          {lista.map((ex, i) => {
            const senalado = [...res.duras, ...res.blandas].some(h => h.ejercicios?.includes(ex.id));
            const parte = ex.parte ?? 3;
            const cabecera = esGym && parte !== parteAnterior && PARTES[parte];
            parteAnterior = parte;
            const open = abierto === i;
            const etiqueta = ex.lineal ? `Lineal ${String(ex.progresion ?? '').replace('.', ',').replace(' kg', '')}` : ex.bs ? `${ex.bs}` : ex.opcional ? 'Opcional' : null;
            return (
              <div key={ex.id + i} className="border-b border-divisor last:border-0">
                {cabecera && <h2 className="text-sm font-medium text-tinta3 pt-4">{PARTES[parte].label}</h2>}
                {modo === 'ordenar' ? (
                  <div className="min-h-[64px] py-2 flex items-center gap-3">
                    <span className="w-6 text-sm text-mudo flex-shrink-0">{String(i + 1).padStart(2, '0')}</span>
                    <span className="flex-1 min-w-0 text-[17px] font-medium leading-snug text-tinta">{ex.nombre}</span>
                    <button onClick={() => subirBajar(i, -1)} disabled={i === 0} aria-label={`Subir ${ex.nombre}`}
                      className="w-12 h-12 rounded-2xl bg-elevada text-tinta flex items-center justify-center flex-shrink-0 disabled:opacity-30">
                      <ArrowUp size={20} />
                    </button>
                    <button onClick={() => subirBajar(i, 1)} disabled={i === lista.length - 1} aria-label={`Bajar ${ex.nombre}`}
                      className="w-12 h-12 rounded-2xl bg-elevada text-tinta flex items-center justify-center flex-shrink-0 disabled:opacity-30">
                      <ArrowDown size={20} />
                    </button>
                  </div>
                ) : (
                <button onClick={() => { setAbierto(open ? null : i); setVerMusculos(false); }} aria-expanded={open}
                  className="w-full min-h-[64px] py-3 flex items-center gap-3 text-left">
                  <span className="w-6 text-sm text-mudo flex-shrink-0">{String(i + 1).padStart(2, '0')}</span>
                  <span className="flex-1 min-w-0">
                    <span className={`block text-[17px] font-medium leading-snug ${senalado ? 'text-red-300' : 'text-tinta'}`}>{ex.nombre}</span>
                    <span className="block text-sm text-tinta3">{ex.series} × {ex.reps ?? '—'}{ex.opcional ? ' · opcional' : ''}</span>
                  </span>
                  {etiqueta && <span className="h-6 px-2 rounded-lg bg-elevada text-xs font-semibold text-tinta2 inline-flex items-center flex-shrink-0">{etiqueta}</span>}
                  <ChevronDown size={18} className={`text-mudo flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                )}

                {open && modo === 'editar' && (
                  <div className="mb-3 p-3 rounded-2xl bg-elevada">
                    <div className="pb-2">
                      <span className="block text-[15px] text-tinta3 mb-1.5">Nombre</span>
                      <input value={ex.nombre} onChange={e => editar(i, { nombre: e.target.value })} aria-label="Nombre del ejercicio"
                        className={`${texto} w-full`} />
                    </div>
                    <div className="pb-1">
                      <button onClick={() => setVerMusculos(v => !v)} aria-expanded={verMusculos}
                        className="w-full min-h-[44px] flex items-center gap-2 text-left">
                        <span className="w-24 text-[15px] text-tinta3 flex-shrink-0">Músculos</span>
                        <span className="flex-1 min-w-0">{(ex.musculos?.primario?.length || ex.musculos?.secundario?.length)
                          ? <Musculos musculos={ex.musculos} /> : <span className="text-[15px] text-ambar">Sin elegir</span>}</span>
                        <ChevronDown size={18} className={`text-mudo flex-shrink-0 transition-transform ${verMusculos ? 'rotate-180' : ''}`} />
                      </button>
                      {verMusculos && <div className="pt-2 pb-3"><SelectorMusculos musculos={ex.musculos} onCambiar={(m) => editar(i, { musculos: m })} /></div>}
                    </div>
                    <Campo label="Se registra">
                      {REGISTROS.map(([k, l]) => (
                        <Opcion key={k} on={registroDe(ex) === k} onClick={() => editar(i, cambioDeRegistro(ex, k))}>{l}</Opcion>
                      ))}
                    </Campo>
                    <Campo label="Series">
                      <button onClick={() => editar(i, { series: Math.max(0, (ex.series || 0) - 1) })} aria-label={`Menos series de ${ex.nombre}`}
                        className="w-11 h-11 rounded-xl bg-fondo text-tinta2 flex items-center justify-center"><Minus size={18} /></button>
                      <span className="w-8 text-center text-xl font-semibold text-tinta" aria-label={`Series de ${ex.nombre}`}>{ex.series}</span>
                      <button onClick={() => editar(i, { series: (ex.series || 0) + 1 })} aria-label={`Más series de ${ex.nombre}`}
                        className="w-11 h-11 rounded-xl bg-fondo text-tinta2 flex items-center justify-center"><Plus size={18} /></button>
                    </Campo>
                    <Campo label="Reps">
                      <input value={ex.reps ?? ''} onChange={e => editar(i, { reps: e.target.value })} aria-label={`Repeticiones de ${ex.nombre}`}
                        placeholder="8-12" className={`${texto} w-28`} />
                    </Campo>
                    <Campo label="Descanso">
                      <input value={ex.descanso ?? ''} onChange={e => editar(i, { descanso: e.target.value })} aria-label={`Descanso de ${ex.nombre}`}
                        placeholder="90s" className={`${texto} w-28`} />
                    </Campo>
                    {esGym && (
                      <Campo label="Progresión">
                        {PROGRESIONES.map(([k, l, cambio]) => (
                          <Opcion key={k} on={progresionDe(ex) === k}
                            onClick={() => editar(i, { ...cambio, rir: cambio.lineal ? ex.rir : (ex.rir ?? '1-2') })}>{l}</Opcion>
                        ))}
                      </Campo>
                    )}
                    {esGym && (
                      <Campo label="Parte">
                        <select value={ex.parte ?? 3} onChange={e => editar(i, { parte: e.target.value === 'finisher' ? 'finisher' : Number(e.target.value) })}
                          aria-label="Parte" className={`${texto} pr-2`}>
                          <option value={1}>Parte 1</option>
                          <option value={2}>Parte 2</option>
                          <option value={3}>Parte 3</option>
                          <option value="finisher">Finisher</option>
                        </select>
                      </Campo>
                    )}
                    {esGym && (
                      <Campo label="Bi-serie">
                        <select value={ex.bs ?? ''} onChange={e => editar(i, { bs: e.target.value || undefined })}
                          aria-label="Bi-serie" className={`${texto} pr-2`}>
                          {grupos.map(g => <option key={g ?? 'none'} value={g ?? ''}>{g ?? 'Sin bi-serie'}</option>)}
                        </select>
                      </Campo>
                    )}
                    <Campo label="Tipo">
                      <Opcion on={!ex.opcional} onClick={() => editar(i, { opcional: false })}>Obligatorio</Opcion>
                      <Opcion on={!!ex.opcional} onClick={() => editar(i, { opcional: true })}>Opcional *</Opcion>
                    </Campo>
                    <div className="pt-2">
                      <span className="block text-[15px] text-tinta3 mb-1.5">Nota</span>
                      <textarea value={ex.nota ?? ''} onChange={e => editar(i, { nota: e.target.value || undefined })} rows={2}
                        aria-label={`Nota de ${ex.nombre}`}
                        className="w-full px-3 py-2.5 bg-fondo border border-borde focus:border-tinta3 focus:outline-none text-tinta text-base rounded-xl resize-none" />
                    </div>
                    <div className="flex gap-2 pt-3">
                      <button onClick={() => subirBajar(i, -1)} disabled={i === 0} aria-label="Subir"
                        className="flex-1 h-11 rounded-xl bg-fondo text-tinta2 text-[15px] font-medium flex items-center justify-center gap-1.5 disabled:opacity-30">
                        <ArrowUp size={16} /> Subir
                      </button>
                      <button onClick={() => subirBajar(i, 1)} disabled={i === lista.length - 1} aria-label="Bajar"
                        className="flex-1 h-11 rounded-xl bg-fondo text-tinta2 text-[15px] font-medium flex items-center justify-center gap-1.5 disabled:opacity-30">
                        <ArrowDown size={16} /> Bajar
                      </button>
                      <button onClick={() => quitar(i)} aria-label={`Quitar ${ex.nombre}`}
                        className="flex-1 h-11 rounded-xl bg-red-950/50 text-red-300 text-[15px] font-medium flex items-center justify-center gap-1.5">
                        <X size={16} /> Quitar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {/* Añadir ejercicio */}
        {nuevo ? (
          <section className="rounded-3xl bg-tarjeta p-4" aria-label="Crear un ejercicio">
            <h2 className="text-xl font-semibold text-tinta">Ejercicio nuevo</h2>
            <div className="mt-3">
              <span className="block text-[15px] text-tinta3 mb-1.5">Nombre</span>
              <input value={nuevo.nombre} onChange={e => setNuevo(n => ({ ...n, nombre: e.target.value }))} aria-label="Nombre del ejercicio nuevo"
                placeholder="Por ejemplo: Remo en T" className={`${texto} w-full h-12`} />
              {nombreRepetido && <p className="text-sm text-ambar mt-1.5">Ya hay un ejercicio con ese nombre en esta rutina.</p>}
            </div>
            <div className="mt-4">
              <span className="block text-[15px] text-tinta3 mb-2">Músculos que trabaja</span>
              <SelectorMusculos musculos={nuevo.musculos} onCambiar={(m) => setNuevo(n => ({ ...n, musculos: m }))} />
            </div>
            <div className="mt-4">
              <span className="block text-[15px] text-tinta3 mb-2">Qué se registra</span>
              <div className="flex flex-wrap gap-2">
                {REGISTROS.map(([k, l]) => (
                  <Opcion key={k} on={nuevo.registro === k} onClick={() => setNuevo(n => ({ ...n, registro: k }))}>{l}</Opcion>
                ))}
              </div>
            </div>
            <div className="mt-3">
              <Campo label="Series">
                <button onClick={() => setNuevo(n => ({ ...n, series: Math.max(1, n.series - 1) }))} aria-label="Menos series"
                  className="w-11 h-11 rounded-xl bg-fondo text-tinta2 flex items-center justify-center"><Minus size={18} /></button>
                <span className="w-8 text-center text-xl font-semibold text-tinta">{nuevo.series}</span>
                <button onClick={() => setNuevo(n => ({ ...n, series: n.series + 1 }))} aria-label="Más series"
                  className="w-11 h-11 rounded-xl bg-fondo text-tinta2 flex items-center justify-center"><Plus size={18} /></button>
              </Campo>
              <Campo label="Reps">
                <input value={nuevo.reps} onChange={e => setNuevo(n => ({ ...n, reps: e.target.value }))} aria-label="Repeticiones del ejercicio nuevo"
                  placeholder="8-12" className={`${texto} w-28`} />
              </Campo>
              <Campo label="Descanso">
                <input value={nuevo.descanso} onChange={e => setNuevo(n => ({ ...n, descanso: e.target.value }))} aria-label="Descanso del ejercicio nuevo"
                  placeholder="90s" className={`${texto} w-28`} />
              </Campo>
            </div>
            <p className="text-sm text-tinta3 mt-2">
              {puedeCrear ? 'Después podrás ajustar su parte, la bi-serie, la progresión y la nota.' : 'Ponle nombre y al menos un músculo principal.'}
            </p>
            <div className="flex gap-2.5 mt-3">
              <button onClick={() => setNuevo(null)} className="flex-1 h-[52px] rounded-2xl bg-elevada text-tinta text-base font-semibold">Cancelar</button>
              <button onClick={crear} disabled={!puedeCrear}
                className="flex-[1.6] h-[52px] rounded-2xl bg-tinta text-[#0d1215] text-base font-semibold disabled:opacity-40">Crear y añadir</button>
            </div>
          </section>
        ) : anadiendo ? (
          <section className="rounded-3xl bg-tarjeta p-4">
            <div className="relative">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tinta3" />
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar ejercicio…" aria-label="Buscar ejercicio"
                className={`${texto} w-full h-12 pl-10`} />
            </div>
            <div className="mt-3 space-y-2">
              {porMusculo.map(([k, ejs]) => {
                const m = MUSCULOS[k];
                const label = m?.label ?? 'Otros';
                const abiertoG = desplegado(k);
                return (
                  <div key={k} className="rounded-2xl bg-elevada">
                    <button onClick={() => alternar(k)}
                      aria-label={`Músculo ${label}`} aria-expanded={abiertoG}
                      className="w-full min-h-[52px] px-4 flex items-center gap-3 text-left">
                      <Punto color={m?.color ?? '#8a97a1'} />
                      <span className="text-[17px] text-tinta flex-1">{label}</span>
                      <span className="text-sm text-tinta3">{ejs.length}</span>
                      <ChevronRight size={18} className={`text-mudo transition-transform ${abiertoG ? 'rotate-90' : ''}`} />
                    </button>
                    {abiertoG && (
                      <div className="px-2 pb-2 space-y-1">
                        {ejs.map(e => (
                          <button key={e.origen + e.id} onClick={() => anadir(e)}
                            className="w-full min-h-[52px] text-left px-3 py-2 rounded-xl bg-fondo flex items-center gap-3">
                            <span className="flex-1 min-w-0">
                              <span className="block text-base text-tinta">{e.nombre}</span>
                              <span className="block text-sm text-tinta3">{e.propio ? 'Creado por ti · ' : ''}{SESION_INFO[e.origen]?.label ?? e.origen}</span>
                            </span>
                            <Plus size={18} className="text-tinta3 flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {!candidatos.length && <p className="text-[15px] text-tinta3 py-2 text-center">Nada que coincida.</p>}
            </div>
            <button onClick={() => setNuevo({ ...NUEVO, nombre: busca })}
              className="w-full mt-3 min-h-[52px] rounded-2xl border border-borde text-[15px] font-medium text-tinta flex items-center justify-center gap-2">
              <Plus size={18} /> Crear un ejercicio que no está en la lista
            </button>
            <button onClick={() => { setAnadiendo(false); setBusca(''); }}
              className="w-full mt-2 h-11 text-[15px] font-medium text-tinta3">Cancelar</button>
          </section>
        ) : (
          <button onClick={() => setAnadiendo(true)}
            className="w-full min-h-[56px] rounded-3xl bg-tarjeta text-[17px] font-medium text-tinta flex items-center justify-center gap-2">
            <Plus size={20} /> Añadir ejercicio
          </button>
        )}

        <button onClick={onRestaurar}
          className="w-full h-12 text-[15px] font-medium text-ambar flex items-center justify-center gap-2">
          <RotateCcw size={16} /> Volver al plan original
        </button>
      </main>

      {/* Guardar */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-fondo border-t border-divisor px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <div className={`${COLUMNA} space-y-2.5`}>
          <input value={motivo} onChange={e => setMotivo(e.target.value)} aria-label="Motivo del cambio"
            placeholder="¿Por qué lo cambias? (opcional)"
            className={`${texto} w-full h-12`} />
          <div className="flex gap-2.5">
            <button onClick={onCerrar} className="flex-1 h-[56px] rounded-2xl bg-elevada text-tinta text-base font-semibold">Cancelar</button>
            <button onClick={() => onGuardar(lista, motivo)}
              className={`flex-[1.6] h-[56px] rounded-2xl text-base font-semibold text-[#0d1215] ${res.duras.length ? 'bg-ambar' : 'bg-tinta'}`}>
              {res.duras.length ? `Guardar con ${res.duras.length} aviso(s)` : 'Guardar'}
            </button>
          </div>
          <p className="text-sm text-tinta3 leading-relaxed">
            Se guarda como versión de hoy. Las sesiones que ya entrenaste conservan los ejercicios que hiciste.
          </p>
        </div>
      </div>
    </div>
  );
};

export default EditorRutina;
