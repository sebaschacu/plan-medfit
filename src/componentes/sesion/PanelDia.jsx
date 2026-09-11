import React, { useState } from 'react';
import { ChevronRight, X, Zap, Check } from 'lucide-react';
import { SESION_INFO, COMPLEMENTOS, DOBLES } from '../../data.js';
import { combinacionValida, ordenDoble, validarSeparacion } from '../../generador.js';
import { GYM_PIERNA_UI } from '../../utiles/constantes-ui.js';
import { contarRender } from '../../utiles/medir.js';
import IconFor from '../comunes/IconFor.jsx';
import NumInput from '../comunes/NumInput.jsx';

// ═══════════════ SEGUNDA SESIÓN Y COMPLEMENTOS ═══════════════
// El déficit de días se cubre doblando, no recortando. Aquí se elige y se valida.
const PanelDia = ({ dia, onSecundaria, onComplemento, onAbrirSesion }) => {
  contarRender('PanelDia');
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

  return (
    <div className="mb-4 space-y-2">
      {/* ─── Segunda sesión ya asignada ─── */}
      {sec && (
        <div className="rounded-lg border border-[#232c34] bg-[#151b21] overflow-hidden">
          <button onClick={() => onAbrirSesion(sec)} className="w-full px-3 py-2.5 flex items-center gap-2.5 text-left">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: SESION_INFO[sec].color + '22', border: `1.5px solid ${SESION_INFO[sec].color}` }}>
              <IconFor name={SESION_INFO[sec].icon} size={15} color={SESION_INFO[sec].color} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">Segunda sesión del día</div>
              <div className="text-sm font-bold" style={{ color: SESION_INFO[sec].color }}>{SESION_INFO[sec].label}</div>
            </div>
            <ChevronRight size={16} className="text-slate-500 flex-shrink-0" />
          </button>
          <div className="px-3 pb-3 space-y-2">
            {dia.franjaSecundaria && (
              <p className="text-[11px] text-cyan-300">Piscina a las {dia.franjaSecundaria.hora}:00{dia.franjaSecundaria.guiado ? ' · guiado' : ''}</p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">Separación</span>
              <NumInput value={sep} onChange={(v) => { setSep(v); onSecundaria(dia.fecha, sec, v === '' ? null : parseFloat(v)); }} placeholder="h" w="w-14" etiqueta="Separación entre sesiones" />
              <span className="text-[10px] text-slate-500">horas</span>
            </div>
            {valSep && (
              <p className={`text-[11px] leading-relaxed ${valSep.nivel === 'aviso' ? 'text-amber-300' : valSep.nivel === 'sin_dato' ? 'text-slate-500' : 'text-emerald-300'}`}>
                {valSep.texto}
              </p>
            )}
            {!valSep?.ordenLibre && orden && (
              <p className="text-[10px] text-slate-500">
                Orden: <span className="font-bold text-slate-300">{SESION_INFO[orden.primero].label}</span> primero,
                después {SESION_INFO[orden.despues].label}.
              </p>
            )}
            {dia.dobleCondicional && (
              <p className="text-[11px] text-amber-300">Posturno: {DOBLES.turnos.P.condicion}.</p>
            )}
            {dia.secundariaManual && (
              <button onClick={() => { onSecundaria(dia.fecha, null, null); setSep(''); }}
                className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <X size={11} /> Quitar la segunda sesión
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── Añadir segunda sesión ─── */}
      {!sec && dia.sesion !== 'descanso' && (
        puedeDoblar ? (
          <div className="rounded-lg border border-[#232c34] bg-[#151b21]">
            <button onClick={() => setAbierto(!abierto)} className="w-full px-3 py-2.5 flex items-center gap-2 text-[11px] font-bold uppercase text-slate-300">
              <Zap size={13} className="text-slate-400" /> Añadir segunda sesión
              <ChevronRight size={14} className={`ml-auto text-slate-500 transition-transform ${abierto ? 'rotate-90' : ''}`} />
            </button>
            {abierto && (
              <div className="px-3 pb-3 space-y-2">
                {infoTurno.condicional && (
                  <p className="text-[10px] text-amber-300/90">Posturno: {infoTurno.condicion}. La ventana es corta.</p>
                )}
                <div className="grid grid-cols-2 gap-1.5">
                  {opciones.map(o => (
                    <button key={o.k} onClick={() => { onSecundaria(dia.fecha, o.k, sep === '' ? null : parseFloat(sep)); setAbierto(false); }}
                      className="py-2 px-2 rounded-lg border border-[#2a3540] text-xs font-bold flex items-center gap-2"
                      style={{ color: SESION_INFO[o.k].color }}>
                      <IconFor name={SESION_INFO[o.k].icon} size={13} color={SESION_INFO[o.k].color} />
                      {SESION_INFO[o.k].label}
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-slate-600 leading-relaxed">
                  Solo aparecen las combinaciones que el plan permite con {SESION_INFO[dia.sesion]?.label}.
                  {GYM_PIERNA_UI.includes(dia.sesion) && ' El running no está: pierna + carrera el mismo día viola S3.'}
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-[10px] text-slate-600 px-1">
            No se doblan sesiones en turno {dia.turno}: {infoTurno?.motivo}.
          </p>
        )
      )}

      {/* ─── Complementos ─── */}
      <div className="rounded-lg border border-[#232c34] bg-[#151b21] px-3 py-2.5">
        <div className="text-[10px] uppercase tracking-wide text-slate-500 font-bold mb-2">Complementos</div>
        {compPermitido ? (
          <>
            <button onClick={() => onComplemento(dia.fecha, 'calistenia', !compActivo)}
              className={`w-full py-2 px-2 rounded-lg border-2 text-xs font-bold flex items-center gap-2 transition-all ${compActivo ? '' : 'border-[#2a3540] text-slate-400'}`}
              style={compActivo ? { borderColor: '#a855f7', background: '#a855f722', color: '#a855f7' } : undefined}>
              <IconFor name="home" size={14} color={compActivo ? '#a855f7' : '#64748b'} />
              {compActivo ? 'Calistenia añadida' : 'Añadir calistenia'}
              {compActivo && <Check size={13} className="ml-auto" strokeWidth={3} />}
            </button>
            {compActivo && compCorto && (
              <p className="text-[10px] text-amber-300 mt-2">Sobre un día de descanso, solo la versión corta: sin bloque de pierna.</p>
            )}
          </>
        ) : (
          <p className="text-[11px] text-slate-500 leading-relaxed">
            <span className="font-bold text-slate-400">Calistenia bloqueada hoy.</span> {comp.motivoBloqueo}
          </p>
        )}
      </div>
    </div>
  );
};

export default PanelDia;
