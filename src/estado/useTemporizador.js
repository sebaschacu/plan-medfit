import { useState, useRef, useCallback, useEffect } from 'react';
import { playBeep, vibrate } from '../utiles/sonido.js';

// ═══════════════ TEMPORIZADOR DE DESCANSO ═══════════════
// Arranca al marcar una serie, avisa al terminar y se limpia solo al desmontar.
// `timerRef` se expone porque toggleSet lo consulta dentro de un updater de
// setState, donde no vale leer estado de React.
export function useTemporizador() {
  const [restTimer, setRestTimer] = useState(null);
  const timerRef = useRef(null);

  const startTimer = useCallback((secs, name) => {
    if (!secs || timerRef.current) return;
    vibrate(100);
    let left = secs;
    setRestTimer({ secondsLeft: left, total: secs, name, done: false });
    timerRef.current = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(timerRef.current); timerRef.current = null;
        setRestTimer({ secondsLeft: 0, total: secs, name, done: true });
        vibrate([200, 100, 200]); playBeep(); setTimeout(playBeep, 500);
        setTimeout(() => setRestTimer(null), 3000);
      } else setRestTimer(p => p ? { ...p, secondsLeft: left } : null);
    }, 1000);
  }, []);

  const skipTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setRestTimer(null);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  return { restTimer, timerRef, startTimer, skipTimer };
}
