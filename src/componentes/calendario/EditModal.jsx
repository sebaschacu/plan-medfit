import React, { useState } from 'react';
import { X, Star, AlertTriangle, RotateCcw } from 'lucide-react';
import { TURNO_INFO, SESION_INFO, clavePrincipal } from '../../data.js';
import { useProgresoCtx, usePlanCtx } from '../../estado/contextos.js';
import { avisoAlFijar } from '../../generador.js';
import MenuSesiones from './MenuSesiones.jsx';
import { Hoja, ChipTurno } from '../comunes/ui.jsx';

// ═══════════════ EDIT DAY MODAL ═══════════════
// `dia`, onSave, onLiberar y onClose vienen de App: el modal es un flag de
// pantalla y cerrarlo es cosa del enrutador. El progreso lo lee de aquí.
const EditModal = ({ dia, onSave, onLiberar, onClose }) => {
  const { progress } = useProgresoCtx();
  const { calendario } = usePlanCtx();
  // Las horas de sueño (__sueno) no son un ejercicio: no cuentan como registro.
  const ejerciciosRegistrados = Object.keys(progress[dia.fecha] || {}).filter(k => !k.startsWith('__')).length;
  const [turno, setTurno] = useState(dia.turno);
  // Natación y running se ven por su variante (Umbral, Tempo…): es lo que el
  // menú puede marcar. Si no se cambia, se guarda el tipo tal cual.
  const actual = clavePrincipal(dia);
  const [sesion, setSesion] = useState(actual);
  const [festivo, setFestivo] = useState(!!dia.festivo);
  const [asumido, setAsumido] = useState(false);

  // Cambiar de sesión un día que ya tiene entrenamiento registrado dejaría ese
  // registro apuntando a ejercicios de otra sesión. Se avisa y se exige confirmar.
  const cambiaSesion = sesion !== actual;
  const destruye = cambiaSesion && ejerciciosRegistrados > 0;
  const bloqueado = destruye && !asumido;
  // Fijar a mano se salta las reglas del generador, que solo puede proteger
  // hacia delante: el día anterior ya está en el calendario y moverlo sería
  // reescribir días que no se editaron. Así que se avisa, con la sesión ya
  // elegida y antes de guardar; guardar sigue siendo posible.
  const avisos = cambiaSesion ? avisoAlFijar(calendario, dia.fecha, sesion) : [];
  return (
    <Hoja onCerrar={onClose} etiqueta={`Editar día ${dia.dia}`}>
      <div className="px-5 pt-2 pb-3 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-2xl font-semibold text-tinta">Editar día {dia.dia} · {dia.sem}</h3>
          <p className="text-sm text-tinta3 mt-0.5">Se fija este día y se recalcula lo que viene después</p>
        </div>
        <button onClick={onClose} aria-label="Cerrar" className="w-11 h-11 rounded-full bg-elevada flex items-center justify-center text-tinta2 flex-shrink-0"><X size={20} /></button>
      </div>
      <div className="px-5 space-y-5">
        <div>
          <div className="rotulo mb-2">Turno</div>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(TURNO_INFO).map(([k, v]) => (
              <button key={k} onClick={() => setTurno(k)} aria-pressed={turno === k}
                className={`min-h-[64px] rounded-2xl flex flex-col items-center justify-center gap-1 ${turno === k ? '' : 'bg-elevada'}`}
                style={turno === k ? { background: v.color + '22', boxShadow: `inset 0 0 0 2px ${v.color}` } : undefined}>
                <ChipTurno turno={k} />
                <span className="text-sm text-tinta2 leading-tight">{v.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="rotulo mb-2">Sesión</div>
          <MenuSesiones sesion={sesion} onElegir={setSesion} fecha={dia.fecha} />
        </div>
        <button onClick={() => setFestivo(!festivo)} aria-pressed={festivo}
          className="w-full min-h-[56px] px-4 rounded-2xl bg-elevada flex items-center gap-3 text-left">
          <Star size={20} className="text-pink-400 flex-shrink-0" fill={festivo ? 'currentColor' : 'none'} />
          <span className="flex-1 text-[17px] text-tinta">{festivo ? 'Es festivo (piscina cerrada)' : 'Marcar como festivo'}</span>
          <span className={`w-12 h-7 rounded-full p-0.5 flex-shrink-0 ${festivo ? 'bg-pink-400' : 'bg-borde'}`} aria-hidden="true">
            <span className={`block w-6 h-6 rounded-full bg-tinta transition-transform ${festivo ? 'translate-x-5' : ''}`} />
          </span>
        </button>

        {/* Aviso: la sesión elegida solapa con el gym anterior, o rompe S7 */}
        {avisos.length > 0 && (
          <div className="p-4 rounded-2xl" style={{ background: 'rgba(245,158,11,0.10)' }}>
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={18} className="text-ambar flex-shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <p className="text-[15px] font-semibold text-ambar">
                  {SESION_INFO[sesion]?.label} aquí {avisos.length === 1 ? 'tiene un problema' : `tiene ${avisos.length} problemas`}, pero puedes guardar igual:
                </p>
                {avisos.map((a, i) => (
                  <p key={i} className="text-sm text-[#f3d9a4] leading-relaxed">
                    <span className="font-semibold">{a.regla === 'S7' ? 'S7 · ' : 'Solape · '}</span>{a.texto}
                  </p>
                ))}
                <p className="text-sm text-[#f3d9a4] leading-relaxed">
                  Nada se reescribe por este aviso: los días que no edites se quedan como están.
                </p>
              </div>
            </div>
          </div>
        )}
        {/* Aviso: este día ya tiene entrenamiento registrado */}
        {destruye && (
          <div className="p-4 rounded-2xl bg-red-950/40">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-100 leading-relaxed">
                <span className="font-semibold">Este día ya tiene entrenamiento registrado</span> ({ejerciciosRegistrados}{' '}
                {ejerciciosRegistrados === 1 ? 'ejercicio' : 'ejercicios'}). Cambiarlo de {SESION_INFO[actual]?.label} a {SESION_INFO[sesion]?.label} dejaría
                ese registro apuntando a ejercicios que no existen en la sesión nueva, así que <span className="font-semibold">se borrará</span>.
                Tus PRs históricos no se tocan.
              </div>
            </div>
            <label className="flex items-center gap-3 mt-3 min-h-[44px] cursor-pointer">
              <input type="checkbox" checked={asumido} onChange={(e) => setAsumido(e.target.checked)}
                className="w-5 h-5 accent-red-500 flex-shrink-0" />
              <span className="text-[15px] font-semibold text-red-200">Entiendo, borra el registro de este día</span>
            </label>
          </div>
        )}
        {dia.fijado && !dia.fijadoAuto && (
          <div className="rounded-2xl bg-elevada px-4 py-3">
            <p className="text-sm text-tinta3">Este día está fijado a mano.</p>
            <button onClick={() => onLiberar(dia.fecha)}
              className="h-11 text-[15px] font-semibold text-ambar flex items-center gap-2">
              <RotateCcw size={16} /> Soltar este día y dejar que lo genere
            </button>
          </div>
        )}
        {dia.fijadoAuto && !destruye && (
          <p className="text-sm text-tinta3 leading-relaxed">
            Este día quedó fijado solo porque tiene entrenamiento registrado. El generador no lo moverá.
          </p>
        )}
      </div>
      <div className="flex gap-2.5 p-5">
        <button onClick={onClose} className="flex-1 h-[56px] rounded-2xl bg-elevada text-tinta text-base font-semibold">Cancelar</button>
        <button onClick={() => onSave(dia.fecha, turno, cambiaSesion ? sesion : dia.sesion, festivo, destruye)} disabled={bloqueado}
          className={`flex-[1.4] h-[56px] rounded-2xl text-base font-semibold ${
            bloqueado ? 'bg-elevada text-mudo' : destruye ? 'bg-red-600 text-white' : 'bg-tinta text-[#0d1215]'}`}>
          {destruye ? 'Cambiar y borrar' : 'Guardar y fijar'}
        </button>
      </div>
    </Hoja>
  );
};

export default EditModal;
