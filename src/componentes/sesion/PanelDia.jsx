import React, { useState } from 'react';
import { ChevronRight, X, Plus, Check } from 'lucide-react';
import { SESION_INFO, COMPLEMENTOS, DOBLES } from '../../data.js';
import { combinacionValida, ordenDoble, validarSeparacion } from '../../generador.js';
import { GYM_PIERNA_UI } from '../../utiles/constantes-ui.js';
import { contarRender } from '../../utiles/medir.js';
import { useAccionesCtx } from '../../estado/contextos.js';
import NumInput from '../comunes/NumInput.jsx';
import { Punto } from '../comunes/ui.jsx';

// ═══════════════ SEGUNDA SESIÓN Y COMPLEMENTOS ═══════════════
// El déficit de días se cubre doblando, no recortando. Aquí se elige y se valida.
const PanelDia = ({ dia, reducida = false, nEjerciciosSec = 0 }) => {
  contarRender('PanelDia');
  const { onSecundaria, onComplemento, abrirSesionDelDia: onAbrirSesion } = useAccionesCtx();
  const [abierto, setAbierto] = useState(false);
  const [sep, setSep] = useState(dia.separacionH ?? '');
  const puedeDoblar = DOBLES.turnos[dia.turno]?.permite;
  const infoTurno = DOBLES.turnos[dia.turno];
  const sec = dia.sesionSecundaria;

  // Solo se ofrecen las combinaciones que el plan permite con esta principal
  const opciones = Object.keys(SESION_INFO)
    .filter(k => k !== 'descanso')
    .map(k => ({ k, ...combinacionValida(dia.sesion, k) }))
    .filter(o => o.ok);

  const comp = COMPLEMENTOS.calistenia;
  const compPermitido = comp.permite.includes(dia.sesion);
  const compActivo = (dia.complementos ?? []).includes('calistenia');
  const compCorto = comp.cortaSobre.includes(dia.sesion);
  const valSep = sec ? validarSeparacion(sep === '' ? null : sep, dia.sesion, sec) : null;
  const orden = sec ? ordenDoble(dia.sesion, sec) : null;
  const claveSec = sec === 'natacion' && dia.varianteSecundaria ? dia.varianteSecundaria : sec;

  return (
    <>
      {/* ─── Segunda sesión ya asignada ─── */}
      {sec && (
        <div className="rounded-3xl bg-tarjeta">
          <button onClick={() => onAbrirSesion(sec)} className="w-full min-h-[72px] px-5 py-3 flex items-center gap-3 text-left">
            <div className="flex-1 min-w-0">
              <div className="rotulo">Segunda sesión del día</div>
              <div className="text-[19px] font-semibold text-tinta flex items-center gap-2 mt-0.5">
                <Punto color={SESION_INFO[claveSec]?.color} />
                {sec === 'natacion' && claveSec !== sec ? `Natación · ${SESION_INFO[claveSec].label}` : SESION_INFO[sec].label}
              </div>
              {nEjerciciosSec > 0 && <div className="text-sm text-tinta3 mt-0.5">{nEjerciciosSec} bloques · tocar para abrirla</div>}
            </div>
            <ChevronRight size={20} className="text-mudo flex-shrink-0" />
          </button>
          <div className="px-5 pb-4 space-y-2.5 border-t border-divisor pt-3">
            {dia.franjaSecundaria && (
              <p className="text-[15px] text-tinta2">Piscina a las {dia.franjaSecundaria.hora}:00{dia.franjaSecundaria.guiado ? ' · guiado' : ''}</p>
            )}
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-[15px] text-tinta3">Separación</span>
              <NumInput value={sep} onChange={(v) => { setSep(v); onSecundaria(dia.fecha, sec, v === '' ? null : parseFloat(v)); }} placeholder="h" etiqueta="Separación entre sesiones" />
              <span className="text-[15px] text-tinta3">horas</span>
            </div>
            {valSep && (
              <p className={`text-sm leading-relaxed ${valSep.nivel === 'aviso' ? 'text-ambar' : valSep.nivel === 'sin_dato' ? 'text-tinta3' : 'text-emerald-300'}`}>
                {valSep.texto}
              </p>
            )}
            {!valSep?.ordenLibre && orden && (
              <p className="text-sm text-tinta3">
                Orden: <span className="font-semibold text-tinta2">{SESION_INFO[orden.primero].label}</span> primero,
                después {SESION_INFO[orden.despues].label}.
              </p>
            )}
            {dia.dobleCondicional && (
              <p className="text-sm text-ambar">Posturno: {DOBLES.turnos.P.condicion}.</p>
            )}
            {dia.secundariaManual && (
              <button onClick={() => { onSecundaria(dia.fecha, null, null); setSep(''); }}
                className="h-11 text-sm font-medium text-tinta3 flex items-center gap-1.5">
                <X size={16} /> Quitar la segunda sesión
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── Añadir segunda sesión ─── */}
      {/* Con menos de 6 h de sueño no se dobla: se quita la opción, no se avisa después. */}
      {!sec && dia.sesion !== 'descanso' && reducida && (
        <p className="text-sm text-tinta3 px-1">Hoy sin segunda sesión: dormiste menos de 6 h.</p>
      )}
      {!sec && dia.sesion !== 'descanso' && !reducida && (
        puedeDoblar ? (
          <div className="rounded-3xl bg-tarjeta">
            <button onClick={() => setAbierto(!abierto)} aria-expanded={abierto}
              className="w-full min-h-[56px] px-4 flex items-center gap-3 text-[17px] font-medium text-tinta text-left">
              <span className="w-8 h-8 rounded-xl bg-elevada flex items-center justify-center text-tinta2 flex-shrink-0"><Plus size={18} /></span>
              Añadir segunda sesión
              <ChevronRight size={20} className={`ml-auto text-mudo transition-transform ${abierto ? 'rotate-90' : ''}`} />
            </button>
            {abierto && (
              <div className="px-4 pb-4 space-y-3">
                {infoTurno.condicional && (
                  <p className="text-sm text-ambar">Posturno: {infoTurno.condicion}. La ventana es corta.</p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {opciones.map(o => (
                    <button key={o.k} onClick={() => { onSecundaria(dia.fecha, o.k, sep === '' ? null : parseFloat(sep)); setAbierto(false); }}
                      className="min-h-[48px] px-3 rounded-2xl bg-elevada text-[15px] font-medium text-tinta flex items-center gap-2 text-left">
                      <Punto color={SESION_INFO[o.k].color} />
                      {SESION_INFO[o.k].label}
                    </button>
                  ))}
                </div>
                <p className="text-sm text-tinta3 leading-relaxed">
                  Solo aparecen las combinaciones que el plan permite con {SESION_INFO[dia.sesion]?.label}.
                  {GYM_PIERNA_UI.includes(dia.sesion) && ' El running no está: pierna + carrera el mismo día viola S3.'}
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-tinta3 px-1">
            No se doblan sesiones en turno {dia.turno}: {infoTurno?.motivo}.
          </p>
        )
      )}

      {/* ─── Complementos ─── */}
      {compPermitido ? (
        <div>
          <button onClick={() => onComplemento(dia.fecha, 'calistenia', !compActivo)} aria-pressed={compActivo}
            className="w-full min-h-[56px] px-4 rounded-3xl bg-tarjeta text-[17px] font-medium text-tinta flex items-center gap-3 text-left"
            style={compActivo ? { boxShadow: 'inset 0 0 0 2px #a855f7' } : undefined}>
            <span className="w-8 h-8 rounded-xl bg-elevada flex items-center justify-center flex-shrink-0" style={{ color: '#a855f7' }}>
              {compActivo ? <Check size={18} strokeWidth={3} /> : <Plus size={18} />}
            </span>
            {compActivo ? 'Calistenia añadida' : 'Añadir calistenia'}
          </button>
          {compActivo && compCorto && (
            <p className="text-sm text-ambar mt-2 px-1">Sobre un día de descanso, solo la versión corta: sin bloque de pierna.</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-tinta3 leading-relaxed px-1 flex items-start gap-2">
          <Punto color="#a855f7" className="mt-1.5" />
          <span><span className="font-semibold text-tinta2">Calistenia bloqueada hoy.</span> {comp.motivoBloqueo}</span>
        </p>
      )}
    </>
  );
};

export default PanelDia;
