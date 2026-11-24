import React, { useState, useRef } from 'react';
import { ArrowLeft, Download, Upload, Check, CalendarDays, Repeat, ListOrdered, Trophy, RotateCcw } from 'lucide-react';
import { SESION_INFO } from '../../data.js';
import { COLUMNA } from '../../utiles/constantes-ui.js';
import { usePlanCtx, useProgresoCtx, useAccionesCtx } from '../../estado/contextos.js';
import { Hoja } from '../comunes/ui.jsx';
import { Fila } from './piezas.jsx';
import AjustesSemana from './AjustesSemana.jsx';
import AjustesTurnos from './AjustesTurnos.jsx';
import AjustesRotacion from './AjustesRotacion.jsx';
import { ListaDeportes, FormDeporte } from './AjustesDeportes.jsx';
import AjustesAviso from './AjustesAviso.jsx';

// ═══════════════ AJUSTES ═══════════════
// Arriba, el plan: la semana, los turnos, la rotación y tus deportes. Cada uno
// abre su pantalla y nada cambia hasta pulsar Guardar en ella.
// Abajo, tus datos: exportar e importar el respaldo, para pasar todo del PC al
// teléfono sin servidor. Importar REEMPLAZA lo de este dispositivo, así que se
// confirma antes.
//
// `seccion` vive en App y no aquí: al volver del editor de rutina de un deporte,
// la pantalla tiene que seguir donde estaba.
const AjustesView = ({ seccion, setSeccion, onEditarRutina }) => {
  const { saveStatus, mensajeDatos } = useProgresoCtx();
  const { config, planCfg } = usePlanCtx();
  const { onExportar, onImportar, irA, setConfig } = useAccionesCtx();
  const [porImportar, setPorImportar] = useState(null);    // File pendiente de confirmar
  const [restaurando, setRestaurando] = useState(false);
  const input = useRef(null);
  const fila = 'w-full min-h-[64px] px-5 py-3 flex items-center gap-3.5 text-left';

  if (seccion === 'semana') return <AjustesSemana onVolver={() => setSeccion(null)} />;
  if (seccion === 'turnos') return <AjustesTurnos onVolver={() => setSeccion(null)} />;
  if (seccion === 'rotacion') return <AjustesRotacion onVolver={() => setSeccion(null)} />;
  if (seccion === 'deportes') return <ListaDeportes onVolver={() => setSeccion(null)} onAbrir={(id) => setSeccion(`deporte:${id}`)} />;
  if (seccion?.startsWith('deporte:')) {
    const id = seccion.slice(8);
    return <FormDeporte key={id} id={id === 'nuevo' ? null : id} onVolver={() => setSeccion('deportes')} onEditarRutina={onEditarRutina} />;
  }

  const c = planCfg.cupo;
  const deportes = (config.deportes ?? []).filter(d => !d.archivado);

  return (
    <div className="min-h-screen bg-fondo">
      <header className={`px-4 pt-3 pb-2 ${COLUMNA}`}>
        <button onClick={() => irA('hoy')} className="h-11 flex items-center gap-1.5 text-tinta3 text-[15px] font-medium">
          <ArrowLeft size={20} /> Hoy
        </button>
        <h1 className="text-[30px] leading-9 font-semibold tracking-[-0.02em] text-tinta px-1">Ajustes</h1>
      </header>
      <main className={`px-4 ${COLUMNA} pb-28 space-y-3`}>
        <div className="rotulo px-1 pt-2">Tu plan</div>
        <section className="rounded-3xl bg-tarjeta divide-y divide-divisor">
          <Fila titulo="Tu semana" icono={<CalendarDays size={20} />} onClick={() => setSeccion('semana')} cambiado={!!config.cupo}
            resumen={`${c.gym} gym · ${c.natacion} natación · ${c.running} running o bici${c.flexible ? ' · día flexible' : ''}`} />
          <Fila titulo="Turnos" icono={<Repeat size={20} />} onClick={() => setSeccion('turnos')} cambiado={!!(config.turnos || config.ciclo)}
            resumen={`Ciclo ${planCfg.ciclo.join(' → ')}`} />
          <Fila titulo="Orden de rotación" icono={<ListOrdered size={20} />} onClick={() => setSeccion('rotacion')} cambiado={!!config.rotacion}
            resumen={planCfg.secGym.map(k => SESION_INFO[k].label).join(' → ')} />
          <Fila titulo="Tus deportes" icono={<Trophy size={20} />} onClick={() => setSeccion('deportes')} cambiado={false}
            resumen={deportes.length ? deportes.map(d => d.nombre).join(' · ') : 'Ninguno todavía'} />
        </section>
        {planCfg.personalizada && (
          restaurando ? (
            <div className="rounded-3xl bg-tarjeta p-5">
              <p className="text-[15px] text-tinta2 leading-relaxed">
                Vuelve todo a lo del plan: la semana, los turnos, la rotación y tus deportes{deportes.length ? ' (se borran de los menús y del calendario)' : ''}.
                Tu historial, tus rutinas editadas y los días fijados no se tocan.
              </p>
              <div className="flex gap-2.5 mt-3">
                <button onClick={() => setRestaurando(false)} className="flex-1 h-12 rounded-2xl bg-elevada text-tinta text-[15px] font-semibold">Mejor no</button>
                <button onClick={() => { setConfig({}); setRestaurando(false); }} className="flex-1 h-12 rounded-2xl bg-ambar text-[#0d1215] text-[15px] font-semibold">Volver al plan</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setRestaurando(true)} className="w-full h-12 text-[15px] font-medium text-ambar flex items-center justify-center gap-2">
              <RotateCcw size={16} /> Volver al plan original
            </button>
          )
        )}

        <div className="rotulo px-1 pt-4">Avisos</div>
        <AjustesAviso />

        <div className="rotulo px-1 pt-4">Tus datos</div>
        <section className="rounded-3xl bg-tarjeta divide-y divide-divisor">
          <button onClick={onExportar} className={fila}>
            <span className="w-10 h-10 rounded-xl bg-elevada flex items-center justify-center text-tinta2 flex-shrink-0"><Download size={20} /></span>
            <span className="flex-1">
              <span className="block text-[17px] font-medium text-tinta">Exportar</span>
              <span className="block text-sm text-tinta3">Descarga un archivo con todo</span>
            </span>
          </button>
          <button onClick={() => input.current?.click()} className={fila}>
            <span className="w-10 h-10 rounded-xl bg-elevada flex items-center justify-center text-tinta2 flex-shrink-0"><Upload size={20} /></span>
            <span className="flex-1">
              <span className="block text-[17px] font-medium text-tinta">Importar</span>
              <span className="block text-sm text-tinta3">Carga un archivo exportado antes</span>
            </span>
          </button>
          <input ref={input} type="file" accept="application/json,.json" className="hidden" aria-label="Archivo de respaldo"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) setPorImportar(f); e.target.value = ''; }} />
        </section>
        {mensajeDatos && (
          <p className={`px-1 text-[15px] font-medium ${mensajeDatos.ok ? 'text-emerald-400' : 'text-red-400'}`}>{mensajeDatos.texto}</p>
        )}
        <p className="px-1 text-sm text-tinta3 leading-relaxed">
          El archivo lleva tu progreso, cargas, PRs, días fijados, rutinas editadas, test CSS, complementos y estos ajustes del plan.
          Sirve para pasar todo del PC al teléfono.
        </p>
        <p className="px-1 text-sm text-tinta3 flex items-center gap-1.5 h-6">
          {saveStatus === 'saved' && <><Check size={16} className="text-emerald-400" strokeWidth={3} /> Todo guardado en este dispositivo</>}
        </p>
      </main>

      {porImportar && (
        <Hoja onCerrar={() => setPorImportar(null)} etiqueta="Confirmar importación">
          <div className="px-5 pt-3 pb-5">
            <h2 className="text-2xl font-semibold text-tinta">¿Importar este archivo?</h2>
            <p className="text-[15px] text-tinta2 mt-2 leading-relaxed">
              Importar <b className="text-tinta">reemplaza todo</b> lo que hay en este dispositivo por lo del archivo
              <span className="text-tinta"> {porImportar.name}</span>. Lo de aquí que no esté en el archivo se pierde.
            </p>
            <div className="flex gap-2.5 mt-5">
              <button onClick={() => setPorImportar(null)} className="flex-1 h-[56px] rounded-2xl bg-elevada text-tinta text-base font-semibold">Cancelar</button>
              <button onClick={() => { onImportar(porImportar); setPorImportar(null); }}
                className="flex-[1.4] h-[56px] rounded-2xl bg-tinta text-[#0d1215] text-base font-semibold">Importar y reemplazar</button>
            </div>
          </div>
        </Hoja>
      )}
    </div>
  );
};

export default AjustesView;
