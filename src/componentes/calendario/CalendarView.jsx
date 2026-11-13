import React, { useState } from 'react';
import { Check, Star, AlertTriangle, Pencil, Moon } from 'lucide-react';
import { TURNO_INFO, SESION_INFO } from '../../data.js';
import { COLUMNA } from '../../utiles/constantes-ui.js';
import { hexARgba } from '../../utiles/formato.js';
import { contarRender } from '../../utiles/medir.js';
import { usePlanCtx, useAccionesCtx } from '../../estado/contextos.js';
import { useResumenMes } from '../../estado/useResumenMes.js';
import { Segmentado, Punto, ChipTurno, Detalle } from '../comunes/ui.jsx';
import BarraCalendario from './BarraCalendario.jsx';

// ═══════════════ CALENDARIO ═══════════════
// Cada celda dice, sin tocarla: qué turno es (la raya de arriba), qué se entrena
// (el nombre y el tinte) y cómo va (hecho, a medias, con aviso).
const DIAS_LARGOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const diaCorto = (f) => DIAS_LARGOS[new Date(f + 'T00:00:00Z').getUTCDay()];
const claveDe = (d) => (d.sesion === 'natacion' ? (d.variante ?? 'natacion') : d.sesion);
// Lo que cabe en una celda: el nombre partido en dos líneas, nunca a mitad de palabra.
const CELDA = {
  gymA: 'Empuje', gymB: 'Tracción', gymD: 'Torso', gymC1: 'Pierna\nfuerza', gymC2: 'Pierna\nvolumen',
  natA1: 'Técnica\ncrawl', natA2: 'Espalda\ny pecho', natA3: 'Estilos', natB1: 'Umbral',
  natB2: 'Aguas\nabiertas', natB3: 'Ritmo\nvariable', natCSS: 'Test\nCSS', natacion: 'Nado',
  running: 'Running', ciclismo: 'Bici', calistenia: 'Calis.',
};
// La segunda sesión, en una palabra.
const SEGUNDA = { running: 'Run', ciclismo: 'Bici', calistenia: 'Calis.' };
const segundaDe = (k) => SEGUNDA[k] ?? (String(k).startsWith('nat') ? 'Nado' : CELDA[k]?.split('\n')[0] ?? SESION_INFO[k]?.label);
const claveSecDe = (d) => (d.sesionSecundaria === 'natacion' ? (d.varianteSecundaria ?? 'natacion') : d.sesionSecundaria);

const CalendarView = ({ onEditDay, editMode, setEditMode }) => {
  contarRender('CalendarView');
  const { calendario, todayISO, mesInfo, avisos } = usePlanCtx();
  const { openDay: onOpenDay } = useAccionesCtx();
  const { dayCompletion } = useResumenMes();
  const [modo, setModo] = useState('mes');
  const alTocar = (d) => (editMode ? onEditDay(d) : onOpenDay(d));

  // Semana: la de hoy si está en este mes; si no, la primera del mes.
  const lunesDe = (f) => { const d = new Date(f + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
  const refSemana = calendario.some(d => d.fecha === todayISO) ? todayISO : calendario[0]?.fecha;
  const semana = refSemana ? calendario.filter(d => lunesDe(d.fecha) === lunesDe(refSemana)) : [];

  return (
    <div className="min-h-screen bg-fondo">
      <BarraCalendario editMode={editMode} setEditMode={setEditMode} />

      <main className={`px-3 pt-1 ${COLUMNA} pb-28`}>
        <Segmentado etiqueta="Vista del calendario" valor={modo} onCambiar={setModo} opciones={[['mes', 'Mes'], ['semana', 'Semana']]} />

        {editMode && (
          <p className="mt-3 px-4 py-3 rounded-2xl text-[15px] text-ambar leading-relaxed flex items-start gap-2.5" style={{ background: 'rgba(245,158,11,0.10)' }}>
            <Pencil size={18} className="flex-shrink-0 mt-0.5" />
            <span>Modo edición: toca un día para cambiar su turno o su sesión. El día queda <b>fijado</b> y el resto del calendario se recalcula respetándolo.</span>
          </p>
        )}

        {/* Leyenda de turnos */}
        <div className="flex items-center gap-4 mt-4 mb-2 flex-wrap px-1">
          {Object.entries(TURNO_INFO).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5">
              <span className="w-4 h-[3px] rounded-full" style={{ background: v.color }} />
              <span className="text-sm text-tinta3">{v.label}</span>
            </div>
          ))}
        </div>

        {modo === 'mes' ? (
          <>
            <div aria-hidden="true" className="grid grid-cols-7 gap-[3px] mb-1.5 text-xs text-tinta3 text-center font-medium">
              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => <span key={d}>{d}</span>)}
            </div>

            <div className="grid grid-cols-7 gap-[3px]">
              {Array.from({ length: mesInfo.primerDiaSemana }).map((_, i) => <div key={`empty-${i}`} className="h-16" />)}

              {calendario.map(d => {
                const turno = TURNO_INFO[d.turno];
                const clave = claveDe(d);
                const ses = SESION_INFO[clave] ?? SESION_INFO[d.sesion];
                const claveSec = claveSecDe(d);
                const sec = claveSec && SESION_INFO[claveSec];
                const comp = dayCompletion(d);
                const hecho = comp === 'full';
                const isToday = todayISO === d.fecha;
                const descanso = d.sesion === 'descanso';
                const aMano = d.fijado && !d.fijadoAuto;
                const nombre = d.flexible && descanso ? 'Día flexible' : ses.label;
                // Para lectores de pantalla y para las pruebas: el nombre entero de lo que toca.
                const etiqueta = `${ses.label}${sec ? ` + ${sec.label}` : ''}${d.flexible && !d.fijado ? ' flex' : ''}`;
                return (
                  <button key={d.fecha} onClick={() => alTocar(d)}
                    data-dia={d.dia} data-etiqueta={etiqueta} data-estado={comp}
                    data-festivo={d.festivo ? '' : undefined} data-fijado-a-mano={aMano ? '' : undefined}
                    aria-label={`${d.dia}, ${turno.label}, ${nombre}${sec ? ` y ${sec.label}` : ''}${hecho ? ', hecho' : comp === 'partial' ? ', a medias' : ''}${isToday ? ', hoy' : ''}`}
                    className="relative h-16 pt-2 pb-1.5 rounded-xl flex flex-col items-center gap-1 overflow-hidden"
                    style={{
                      background: descanso ? '#141a1f' : hexARgba(ses.color, hecho ? 0.26 : 0.12),
                      boxShadow: isToday ? 'inset 0 0 0 1.5px #e8edf0' : hecho ? `inset 0 0 0 1.5px ${hexARgba(ses.color, 0.7)}` : undefined,
                    }}>
                    {/* Turno: la raya de arriba */}
                    <span aria-hidden="true" className="absolute top-0 left-3 right-3 h-[3px] rounded-b-sm" style={{ background: turno.color }} />
                    <span className={`min-w-[20px] h-[18px] px-1 rounded-full text-xs leading-[18px] font-semibold text-center ${isToday ? 'bg-tinta text-[#0d1215]' : 'text-tinta'}`}>
                      {d.dia}
                    </span>
                    {descanso ? (
                      <span className="flex flex-col items-center gap-px text-[#6b7883]">
                        <Moon size={13} />
                        <span className="text-[10px] leading-3 text-mudo">{d.flexible ? 'Flex' : ''}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] leading-3 font-medium tracking-[-0.01em] text-center whitespace-pre-line" style={{ color: '#dfe6ea' }}>
                        {sec ? `${CELDA[clave]?.split('\n')[0] ?? ses.label}\n+ ${segundaDe(claveSec)}` : (CELDA[clave] ?? ses.label)}
                      </span>
                    )}
                    {/* Segunda sesión: raya abajo de su color */}
                    {sec && <span aria-hidden="true" data-segunda className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: sec.color }} />}
                    {/* Esquina derecha: hecho, a medias o calistenia apilada */}
                    {hecho && <Check size={11} strokeWidth={3.5} aria-hidden="true" className="absolute top-1.5 right-1" style={{ color: ses.color }} />}
                    {!hecho && comp === 'partial' && <span aria-hidden="true" className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-ambar" />}
                    {(d.complementos ?? []).length > 0 && !sec && (
                      <span aria-hidden="true" className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full" style={{ background: '#a855f7' }} />
                    )}
                    {/* Esquina izquierda: festivo, o fijado a mano */}
                    {d.festivo && <Star size={9} aria-hidden="true" className="absolute top-1.5 left-1 text-pink-400" fill="currentColor" />}
                    {aMano && !d.festivo && <Pencil size={9} aria-hidden="true" className="absolute top-1.5 left-1 text-ambar" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="rounded-3xl bg-tarjeta px-2 divide-y divide-divisor">
            {semana.map(d => {
              const ses = SESION_INFO[claveDe(d)] ?? SESION_INFO[d.sesion];
              const sec = d.sesionSecundaria && SESION_INFO[claveSecDe(d)];
              const comp = dayCompletion(d);
              return (
                <button key={d.fecha} onClick={() => alTocar(d)} className="w-full min-h-[64px] px-2 py-2.5 flex items-center gap-3 text-left">
                  <span className={`w-14 text-[15px] ${d.fecha === todayISO ? 'text-tinta font-semibold' : 'text-tinta3'}`}>{diaCorto(d.fecha)} {d.dia}</span>
                  <ChipTurno turno={d.turno} />
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2 text-[17px] text-tinta"><Punto color={ses.color} />{d.flexible && d.sesion === 'descanso' ? 'Día flexible' : ses.label}</span>
                    {sec && <span className="flex items-center gap-2 text-[15px] text-tinta2 mt-0.5"><Punto color={sec.color} />{sec.label}</span>}
                  </span>
                  {comp === 'full' && <Check size={18} strokeWidth={3} style={{ color: ses.color }} />}
                  {comp === 'partial' && <span className="w-2 h-2 rounded-full bg-ambar" aria-label="A medias" />}
                </button>
              );
            })}
          </div>
        )}

        {/* Avisos del generador (natación imposible, running tras pierna…): plegados, se abren al tocar */}
        {avisos?.length > 0 && (
          <div className="mt-4 space-y-2">
            {avisos.map((a, i) => (
              <Detalle key={i} tono="ambar" icono={<AlertTriangle size={18} />}>{a.texto}</Detalle>
            ))}
          </div>
        )}

        <p className="text-center text-sm text-tinta3 mt-4 px-4">
          {editMode ? 'Toca un día para cambiarlo' : 'Toca un día para ver o registrar tu entrenamiento'}
        </p>
      </main>
    </div>
  );
};

export default CalendarView;
