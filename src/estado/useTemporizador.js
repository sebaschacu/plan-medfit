import { useState, useRef, useCallback, useEffect } from 'react';
import { playBeep, vibrate } from '../utiles/sonido.js';

// ═══════════════ TEMPORIZADOR DE DESCANSO ═══════════════
// Arranca al marcar una serie, avisa al terminar y se limpia solo al desmontar.
//
// Cada serie marcada REINICIA el descanso con el del ejercicio que acabas de
// marcar. Antes, si marcabas la siguiente serie antes de que sonara, el
// temporizador seguía con la cuenta anterior: el descanso real entre series
// quedaba mal medido. En una bi-serie con descansos distintos manda el del
// ejercicio recién marcado, que es el que llega como argumento.
export function useTemporizador() {
  const [restTimer, setRestTimer] = useState(null);
  const timerRef = useRef(null);        // el setInterval en marcha
  const cierreRef = useRef(null);       // el setTimeout que retira el "Descanso listo"

  const limpiar = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    // Si un descanso anterior acababa de terminar, su cierre programado
    // borraría el overlay del nuevo a los 3 s. Se cancela.
    if (cierreRef.current) clearTimeout(cierreRef.current);
    cierreRef.current = null;
  };

  const startTimer = useCallback((secs, name) => {
    if (!secs) return;
    limpiar();
    vibrate(100);
    let left = secs;
    setRestTimer({ secondsLeft: left, total: secs, name, done: false });
    timerRef.current = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(timerRef.current); timerRef.current = null;
        setRestTimer({ secondsLeft: 0, total: secs, name, done: true });
        vibrate([200, 100, 200]); playBeep(); setTimeout(playBeep, 500);
        cierreRef.current = setTimeout(() => { cierreRef.current = null; setRestTimer(null); }, 3000);
      } else setRestTimer(p => p ? { ...p, secondsLeft: left } : null);
    }, 1000);
  }, []);

  const skipTimer = useCallback(() => {
    limpiar();
    setRestTimer(null);
  }, []);

  useEffect(() => () => limpiar(), []);

  return { restTimer, startTimer, skipTimer };
}
