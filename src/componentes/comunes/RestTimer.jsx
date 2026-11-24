import React, { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { fmtTime } from '../../utiles/formato.js';
import { soportaAviso, estadoAviso, avisoOculto, ocultarAviso, activarAviso, servidorDisponible, iPhoneSinInstalar } from '../../utiles/avisoDescanso.js';

// ═══════════════ ACTIVAR EL AVISO · una línea bajo el contador ═══════════════
// Sale donde hace falta: con un descanso en marcha. Una vez activado (o
// descartado con la X) no vuelve; se cambia en Ajustes → Aviso de descanso.
const ActivarAviso = () => {
  const [ver, setVer] = useState(null);       // null · 'activar' · 'instalar'
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    let vivo = true;
    if (avisoOculto()) return;
    if (iPhoneSinInstalar()) { setVer('instalar'); return; }
    if (!soportaAviso() || estadoAviso() !== 'apagado') return;
    servidorDisponible().then(ok => { if (vivo && ok) setVer('activar'); });
    return () => { vivo = false; };
  }, []);
  if (!ver) return null;
  const cerrar = () => { ocultarAviso(); setVer(null); };
  const activar = async () => {
    const r = await activarAviso();
    if (r === 'activo') { setMsg('Listo: te avisará al acabar cada descanso'); setTimeout(() => setVer(null), 2500); }
    else setMsg(r === 'bloqueado' ? 'Las notificaciones están bloqueadas: actívalas en los ajustes del celular' : 'No se pudo activar. Prueba otra vez');
  };
  return (
    <div className="mt-3 flex items-center gap-2 border-t border-divisor pt-3">
      {msg ? <p className="flex-1 text-sm text-tinta2">{msg}</p>
        : ver === 'instalar'
          ? <p className="flex-1 text-sm text-tinta3">Para que te avise aunque salgas de la app, añádela a la pantalla de inicio (Compartir → Añadir a inicio).</p>
          : <button onClick={activar} className="flex-1 min-h-11 flex items-center gap-2 text-left text-[15px] font-medium text-tinta">
              <Bell size={18} className="flex-shrink-0" /> Avisarme al acabar aunque salga de la app
            </button>}
      {!msg && <button onClick={cerrar} aria-label="No mostrar más" className="w-11 h-11 -mr-2 flex items-center justify-center text-tinta3"><X size={18} /></button>}
    </div>
  );
};

// ═══════════════ DESCANSO · barra inferior ═══════════════
// Aparece sola al dar una serie por hecha. Lo único grande es el tiempo.
// «Corregir» abre la rueda sobre la serie recién guardada. Al acabar se queda
// contando cuánto hace que acabó, hasta que la cierras.
const RestTimer = ({ timer, onSkip, color, guardada, onCorregir }) => {
  if (!timer) return null;
  const { secondsLeft, total, name, done, pasados = 0 } = timer;
  const pct = done ? 100 : total > 0 ? Math.max(0, (secondsLeft / total) * 100) : 0;
  const low = secondsLeft <= 5 && secondsLeft > 0;
  return (
    <div className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-40 rounded-3xl bg-elevada px-5 pt-3.5 pb-4 mb-[env(safe-area-inset-bottom)]"
      role="timer" aria-label="Descanso">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="rotulo" style={done ? { color: '#4ade80' } : undefined}>{done ? (pasados >= 3 ? 'Listo · hace' : 'Descanso listo') : 'Descansando'}</div>
          <div className={`text-[40px] font-semibold leading-none mt-0.5 ${done ? 'text-[#4ade80]' : low ? 'text-ambar' : 'text-tinta'}`}
            data-pasados={done ? pasados : undefined}>
            {done ? (pasados >= 3 ? fmtTime(pasados) : '¡Vamos!') : fmtTime(secondsLeft)}
          </div>
        </div>
        {onCorregir && (
          <button onClick={onCorregir} className="h-12 px-3 text-base font-semibold text-tinta">Corregir</button>
        )}
        <button onClick={onSkip} className="h-12 px-5 rounded-2xl bg-tinta text-[#0d1215] text-base font-semibold">{done ? 'Cerrar' : 'Saltar'}</button>
      </div>
      <div className="mt-3 h-1.5 bg-fondo rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-1000 ease-linear" style={{ width: `${pct}%`, background: done ? '#4ade80' : color }} />
      </div>
      <div className="mt-2 text-sm text-tinta3 truncate">{name}{guardada ? ` · ${guardada}` : ''}</div>
      {!done && <ActivarAviso />}
    </div>
  );
};

export default RestTimer;
