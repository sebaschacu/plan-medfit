import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { soportaAviso, estadoAviso, activarAviso, desactivarAviso, servidorDisponible, iPhoneSinInstalar } from '../../utiles/avisoDescanso.js';

// ═══════════════ AJUSTES · AVISO DE DESCANSO ═══════════════
// Una fila: qué pasa ahora y un botón para cambiarlo. El aviso es una
// notificación que suena y vibra al acabar el descanso si estás en otra app.
const TEXTO = {
  activo: 'Activado · suena y vibra al acabar cada descanso si estás en otra app',
  apagado: 'Apagado · solo verás el contador dentro de la app',
  bloqueado: 'Bloqueado en el celular · actívalo en Ajustes del teléfono → Notificaciones',
  instalar: 'En iPhone, añade la app a la pantalla de inicio (Compartir → Añadir a inicio)',
  'no-soportado': 'Este navegador no puede mandar notificaciones',
  'sin-servidor': 'Aún no está disponible en esta versión',
};

const AjustesAviso = () => {
  const [estado, setEstado] = useState(() => (iPhoneSinInstalar() ? 'instalar' : estadoAviso()));
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    let vivo = true;
    if (estado === 'apagado' || estado === 'activo') servidorDisponible().then(ok => { if (vivo && !ok) setEstado('sin-servidor'); });
    return () => { vivo = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cambiar = async () => {
    setOcupado(true);
    if (estado === 'activo') { await desactivarAviso(); setEstado('apagado'); }
    else { const r = await activarAviso(); setEstado(r === 'error' ? 'apagado' : r); }
    setOcupado(false);
  };
  const puede = soportaAviso() && (estado === 'activo' || estado === 'apagado');
  return (
    <section className="rounded-3xl bg-tarjeta" aria-label="Aviso de descanso">
      <div className="min-h-[64px] px-5 py-3 flex items-center gap-3.5">
        <span className="w-10 h-10 rounded-xl bg-elevada flex items-center justify-center text-tinta2 flex-shrink-0"><Bell size={20} /></span>
        <span className="flex-1 min-w-0">
          <span className="block text-[17px] font-medium text-tinta">Aviso al acabar el descanso</span>
          <span className="block text-sm text-tinta3" data-estado-aviso={estado}>{TEXTO[estado]}</span>
        </span>
        {puede && (
          <button onClick={cambiar} disabled={ocupado}
            className={`h-10 px-4 rounded-xl text-[15px] font-semibold flex-shrink-0 ${estado === 'activo' ? 'bg-elevada text-tinta' : 'bg-tinta text-[#0d1215]'}`}>
            {estado === 'activo' ? 'Apagar' : 'Activar'}
          </button>
        )}
      </div>
    </section>
  );
};

export default AjustesAviso;
