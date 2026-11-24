import { useEffect } from 'react';

// ═══════════════ PANTALLA ENCENDIDA DURANTE LA SESIÓN ═══════════════
// Mientras está abierta una sesión, el celular no se bloquea solo: entre series
// se mira de lejos y el contador tiene que seguir a la vista. Al salir de la
// app el sistema suelta el bloqueo; al volver se pide otra vez. Donde no existe
// (navegadores viejos, iPhone por debajo de iOS 18.4 instalado), no hace nada.
export function usePantallaEncendida(activa = true) {
  useEffect(() => {
    if (!activa || !('wakeLock' in navigator)) return;
    let bloqueo = null, vivo = true;
    const pedir = async () => {
      if (document.visibilityState !== 'visible' || bloqueo) return;
      try {
        bloqueo = await navigator.wakeLock.request('screen');
        if (!vivo) { bloqueo.release().catch(() => {}); return; }
        bloqueo.addEventListener('release', () => { bloqueo = null; });
      } catch { bloqueo = null; }
    };
    pedir();
    document.addEventListener('visibilitychange', pedir);
    return () => {
      vivo = false;
      document.removeEventListener('visibilitychange', pedir);
      bloqueo?.release().catch(() => {});
    };
  }, [activa]);
}
