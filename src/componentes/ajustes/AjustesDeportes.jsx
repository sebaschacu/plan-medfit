import React, { useState } from 'react';
import { Plus, ChevronRight, Archive, ListChecks, Check } from 'lucide-react';
import { TURNO_INFO } from '../../data.js';
import { usePlanCtx, useAccionesCtx } from '../../estado/contextos.js';
import { conCampo, claveDeporte, nuevoIdDeporte, COLORES_DEPORTE, ICONOS_DEPORTE, LETRAS_TURNO } from '../../config.js';
import IconFor from '../comunes/IconFor.jsx';
import BotonSiNo from '../comunes/BotonSiNo.jsx';
import { Segmentado, ChipTurno } from '../comunes/ui.jsx';
import { Pantalla, Paso, VistaPrevia } from './piezas.jsx';

// ═══════════════ TUS DEPORTES ═══════════════
// Deportes que no vienen en el plan: escalada, fútbol, yoga… Cada uno es una
// sesión más, con su color, su rutina y su sitio en el calendario. «A mano»
// los pones tú el día que quieras; «Automático» la app los reparte cada semana.
const NOMBRES_ICONO = { activity: 'Rayo', bike: 'Bici', run: 'Pulso', waves: 'Agua', dumbbell: 'Pesa', mountain: 'Montaña', trophy: 'Trofeo', footprints: 'Huellas' };
const NUEVO = { nombre: '', color: COLORES_DEPORTE[0], icono: 'activity', modo: 'manual', porSemana: 1, turnos: ['L', 'P'], piernas: false, duracion: '60 min', nota: '' };
const texto = 'h-12 px-3 bg-fondo border border-borde focus:border-tinta3 focus:outline-none text-tinta text-base rounded-xl placeholder:text-mudo';

export const ListaDeportes = ({ onVolver, onAbrir }) => {
  const { config } = usePlanCtx();
  const { setConfig } = useAccionesCtx();
  const todos = config.deportes ?? [];
  const activos = todos.filter(d => !d.archivado);
  const archivados = todos.filter(d => d.archivado);
  const recuperar = (id) => setConfig(conCampo(config, 'deportes', todos.map(d => (d.id === id ? { ...d, archivado: false } : d))));
  return (
    <Pantalla titulo="Tus deportes" subtitulo="Lo que haces además del plan. Cada uno tiene su rutina y su color." onVolver={onVolver}>
      <section className="rounded-3xl bg-tarjeta divide-y divide-divisor">
        {activos.map(d => (
          <button key={d.id} onClick={() => onAbrir(d.id)} className="w-full min-h-[68px] px-5 py-3 flex items-center gap-3.5 text-left">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: d.color + '26' }}>
              <IconFor name={d.icono} size={20} color={d.color} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[17px] font-medium text-tinta">{d.nombre}</span>
              <span className="block text-sm text-tinta3 truncate">
                {d.modo === 'auto' ? `Automático · ${d.porSemana} ${d.porSemana === 1 ? 'vez' : 'veces'} por semana` : 'A mano'}{d.duracion ? ` · ${d.duracion}` : ''}
              </span>
            </span>
            <ChevronRight size={18} className="text-mudo flex-shrink-0" />
          </button>
        ))}
        <button onClick={() => onAbrir('nuevo')} className="w-full min-h-[60px] px-5 flex items-center gap-3.5 text-left text-[17px] text-tinta">
          <span className="w-10 h-10 rounded-xl bg-elevada flex items-center justify-center text-tinta2 flex-shrink-0"><Plus size={20} /></span>
          Crear un deporte
        </button>
      </section>
      {!activos.length && (
        <p className="text-sm text-tinta3 px-1 leading-relaxed">
          Todavía no tienes ninguno. Por ejemplo: fútbol con amigos los domingos, escalada, yoga después del turno.
        </p>
      )}
      {archivados.length > 0 && (
        <section className="rounded-3xl bg-tarjeta px-5 pt-4 pb-1">
          <div className="rotulo">Archivados</div>
          <p className="text-sm text-tinta3 mt-1">No salen en el calendario; lo que ya entrenaste se conserva.</p>
          <div className="divide-y divide-divisor mt-1">
            {archivados.map(d => (
              <div key={d.id} className="min-h-[56px] flex items-center gap-3">
                <span className="flex-1 text-[17px] text-tinta3">{d.nombre}</span>
                <button onClick={() => recuperar(d.id)} className="h-11 px-3 text-[15px] font-medium text-tinta">Recuperar</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </Pantalla>
  );
};

export const FormDeporte = ({ id, onVolver, onEditarRutina }) => {
  const { config } = usePlanCtx();
  const { setConfig } = useAccionesCtx();
  const todos = config.deportes ?? [];
  const existente = todos.find(d => d.id === id);
  const [d, setD] = useState(() => ({ ...NUEVO, ...(existente ?? {}) }));
  const [archivando, setArchivando] = useState(false);
  // El id de un deporte nuevo se decide una vez, no en cada pintado
  const [idNuevo] = useState(() => nuevoIdDeporte(todos));
  const cambia = (k, v) => setD(x => ({ ...x, [k]: v }));
  const nombreRepetido = todos.some(x => x.id !== id && x.nombre.toLowerCase() === d.nombre.trim().toLowerCase());
  const valido = d.nombre.trim().length >= 2 && !nombreRepetido && (d.modo === 'manual' || d.turnos.length > 0);
  const final = existente ? d : { ...d, id: idNuevo };
  const lista = existente ? todos.map(x => (x.id === id ? d : x)) : [...todos, final];
  const borrador = conCampo(config, 'deportes', lista);
  const guardar = () => { setConfig(borrador); onVolver(); };

  return (
    <Pantalla titulo={existente ? existente.nombre : 'Deporte nuevo'} volver="Tus deportes"
      onVolver={onVolver} onGuardar={guardar} puedeGuardar={valido} textoGuardar={existente ? 'Guardar' : 'Crear deporte'}>
      <section className="rounded-3xl bg-tarjeta p-5 space-y-4">
        <label className="block">
          <span className="block text-[15px] text-tinta3 mb-1.5">Nombre</span>
          <input value={d.nombre} onChange={e => cambia('nombre', e.target.value)} placeholder="Por ejemplo: Escalada"
            aria-label="Nombre del deporte" className={`${texto} w-full`} />
          {nombreRepetido && <span className="block text-sm text-ambar mt-1.5">Ya tienes un deporte con ese nombre.</span>}
        </label>
        <div>
          <span className="block text-[15px] text-tinta3 mb-2">Color</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
            {COLORES_DEPORTE.map(c => (
              <button key={c} role="radio" aria-checked={d.color === c} aria-label={`Color ${c}`} onClick={() => cambia('color', c)}
                className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: c, boxShadow: d.color === c ? '0 0 0 3px #0d1215, 0 0 0 5px #e8edf0' : undefined }}>
                {d.color === c && <Check size={20} strokeWidth={3} className="text-[#0d1215]" />}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="block text-[15px] text-tinta3 mb-2">Icono</span>
          <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Icono">
            {ICONOS_DEPORTE.map(i => (
              <button key={i} role="radio" aria-checked={d.icono === i} aria-label={`Icono ${NOMBRES_ICONO[i]}`} onClick={() => cambia('icono', i)}
                className={`h-12 rounded-xl flex items-center justify-center ${d.icono === i ? 'bg-fondo' : 'bg-elevada'}`}
                style={d.icono === i ? { boxShadow: `inset 0 0 0 2px ${d.color}` } : undefined}>
                <IconFor name={i} size={22} color={d.icono === i ? d.color : '#b2bdc5'} />
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="block text-[15px] text-tinta3 mb-1.5">Cuánto dura</span>
          <input value={d.duracion} onChange={e => cambia('duracion', e.target.value)} placeholder="60 min"
            aria-label="Duración del deporte" className={`${texto} w-40`} />
        </label>
      </section>

      <section className="rounded-3xl bg-tarjeta p-5 space-y-4">
        <div>
          <span className="block text-[15px] text-tinta3 mb-2">¿Cómo entra en el calendario?</span>
          <Segmentado etiqueta="Cómo entra en el calendario" valor={d.modo} onCambiar={(v) => cambia('modo', v)}
            opciones={[['manual', 'A mano'], ['auto', 'Automático']]} />
          <p className="text-sm text-tinta3 mt-2 leading-relaxed">
            {d.modo === 'auto'
              ? 'La app lo reparte cada semana en los días que queden libres en tus turnos. Si no queda ninguno, lo pone como segunda sesión de un día; si tampoco cabe, te avisa.'
              : 'Lo pones tú: al editar un día del calendario, o como segunda sesión desde la pantalla del día.'}
          </p>
        </div>
        {d.modo === 'auto' && (
          <>
            <div className="-mx-5 border-y border-divisor">
              <Paso label="Veces por semana" valor={d.porSemana} min={1} max={5} onCambiar={(v) => cambia('porSemana', v)} />
            </div>
            <div>
              <span className="block text-[15px] text-tinta3 mb-2">En qué turnos</span>
              <div className="grid grid-cols-2 gap-2">
                {LETRAS_TURNO.map(t => {
                  const on = d.turnos.includes(t);
                  return (
                    <button key={t} aria-pressed={on} onClick={() => cambia('turnos', on ? d.turnos.filter(x => x !== t) : LETRAS_TURNO.filter(x => x === t || d.turnos.includes(x)))}
                      className={`min-h-[52px] px-3 rounded-2xl flex items-center gap-2.5 text-[15px] ${on ? 'bg-fondo text-tinta font-semibold' : 'bg-elevada text-tinta3'}`}
                      style={on ? { boxShadow: `inset 0 0 0 2px ${TURNO_INFO[t].color}` } : undefined}>
                      <ChipTurno turno={t} /> {TURNO_INFO[t].label}
                    </button>
                  );
                })}
              </div>
              {!d.turnos.length && <p className="text-sm text-ambar mt-2">Elige al menos un turno.</p>}
            </div>
          </>
        )}
        <div>
          <span className="block text-[15px] text-tinta3 mb-2">¿Carga las piernas?</span>
          <div className="flex gap-2.5">
            <BotonSiNo activo={d.piernas} onClick={() => cambia('piernas', true)}>Sí</BotonSiNo>
            <BotonSiNo activo={!d.piernas} onClick={() => cambia('piernas', false)}>No</BotonSiNo>
          </div>
          <p className="text-sm text-tinta3 mt-2 leading-relaxed">
            Si las carga, la app no lo pone el día después de pierna ni lo junta con pierna, running o bici el mismo día (como la regla S3).
          </p>
        </div>
        <label className="block">
          <span className="block text-[15px] text-tinta3 mb-1.5">Nota (opcional)</span>
          <textarea value={d.nota} onChange={e => cambia('nota', e.target.value)} rows={2} aria-label="Nota del deporte"
            placeholder="Por ejemplo: con el equipo de la universidad"
            className="w-full px-3 py-2.5 bg-fondo border border-borde focus:border-tinta3 focus:outline-none text-tinta text-base rounded-xl resize-none placeholder:text-mudo" />
        </label>
      </section>

      {d.modo === 'auto' && valido && <VistaPrevia config={borrador} />}

      {existente && (
        <section className="rounded-3xl bg-tarjeta divide-y divide-divisor">
          <button onClick={() => onEditarRutina(claveDeporte(id))} className="w-full min-h-[60px] px-5 flex items-center gap-3.5 text-left text-[17px] text-tinta">
            <ListChecks size={20} className="text-tinta2" /> Editar sus ejercicios
            <ChevronRight size={18} className="ml-auto text-mudo" />
          </button>
          {!archivando ? (
            <button onClick={() => setArchivando(true)} className="w-full min-h-[60px] px-5 flex items-center gap-3.5 text-left text-[17px] text-tinta3">
              <Archive size={20} /> Archivar este deporte
            </button>
          ) : (
            <div className="px-5 py-4">
              <p className="text-[15px] text-tinta2 leading-relaxed">Deja de salir en el calendario y en los menús. Los días que ya entrenaste se conservan, y puedes recuperarlo cuando quieras.</p>
              <div className="flex gap-2.5 mt-3">
                <button onClick={() => setArchivando(false)} className="flex-1 h-12 rounded-2xl bg-elevada text-tinta text-[15px] font-semibold">Mejor no</button>
                <button onClick={() => { setConfig(conCampo(config, 'deportes', todos.map(x => (x.id === id ? { ...x, archivado: true } : x)))); onVolver(); }}
                  className="flex-1 h-12 rounded-2xl bg-ambar text-[#0d1215] text-[15px] font-semibold">Archivar</button>
              </div>
            </div>
          )}
        </section>
      )}
    </Pantalla>
  );
};
