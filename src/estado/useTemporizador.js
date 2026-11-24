import { useState, useRef, useCallback, useEffect } from 'react';
import { playBeep, vibrate } from '../utiles/sonido.js';
import { pedirAviso, cancelarAviso, prepararAviso } from '../utiles/avisoDescanso.js';

// ═══════════════ TEMPORIZADOR DE DESCANSO ═══════════════
// Arranca al marcar una serie, avisa al terminar y se limpia solo al desmontar.
//
// Cada serie marcada REINICIA el descanso con el del ejercicio que acabas de
// marcar. Antes, si marcabas la siguiente serie antes de que sonara, el
// temporizador seguía con la cuenta anterior: el descanso real entre series
// quedaba mal medido. En una bi-serie con descansos distintos manda el del
// ejercicio recién marcado, que es el que llega como argumento.
//
// Cuenta con la HORA DE FIN, no restando un segundo en cada vuelta: al salir de
// la app el celular congela los temporizadores, y al volver la cuenta seguía
// donde se quedó (marcaba más tiempo del que quedaba). Ahora, al volver, se
// recalcula con el reloj y se ve lo que de verdad queda.
//
// Si acaba mientras no miras, se queda en «Descanso listo · hace 0:40» hasta que
// lo cierras (antes desaparecía a los 3 s y no te enterabas). Y si sales de la
// app con el descanso en marcha, se pide el aviso por notificación.
let siguienteId = 1;

export function useTemporizador() {
  const [restTimer, setRestTimer] = useState(null);
  const actual = useRef(null);     // { id, fin, total, name, sonado }
  const vuelta = useRef(null);     // el setInterval que repinta

  const pintar = useCallback(() => {
    const t = actual.current;
    if (!t) return;
    const ahora = Date.now();
    const quedan = Math.ceil((t.fin - ahora) / 1000);
    if (quedan > 0) {
      setRestTimer(p => (p?.id === t.id && !p.done && p.secondsLeft === quedan) ? p
        : { id: t.id, secondsLeft: quedan, total: t.total, name: t.name, done: false, pasados: 0 });
      return;
    }
    const pasados = Math.floor((ahora - t.fin) / 1000);
    if (!t.sonado) {
      t.sonado = true;
      // Suena y vibra solo si lo estás mirando justo al acabar; si volviste más
      // tarde, ya te avisó la notificación.
      if (document.visibilityState === 'visible' && pasados < 3) {
        vibrate([200, 100, 200]); playBeep(); setTimeout(playBeep, 500);
      }
    }
    setRestTimer(p => (p?.id === t.id && p.done && p.pasados === pasados) ? p
      : { id: t.id, secondsLeft: 0, total: t.total, name: t.name, done: true, pasados });
  }, []);

  const parar = () => {
    if (vuelta.current) clearInterval(vuelta.current);
    vuelta.current = null;
    if (actual.current) cancelarAviso(actual.current.id);
    actual.current = null;
  };

  const startTimer = useCallback((secs, name) => {
    if (!secs) return;
    parar();
    vibrate(100);
    actual.current = { id: `d${Date.now().toString(36)}${siguienteId++}`, fin: Date.now() + secs * 1000, total: secs, name, sonado: false };
    pintar();
    vuelta.current = setInterval(pintar, 250);
  }, [pintar]);

  const skipTimer = useCallback(() => {
    parar();
    setRestTimer(null);
  }, []);

  // Al salir de la app: pedir el aviso. Al volver: recalcular ya (sin esperar a la
  // siguiente vuelta) y cancelar el aviso si aún no ha acabado.
  useEffect(() => {
    prepararAviso();
    const cambio = () => {
      const t = actual.current;
      if (document.visibilityState === 'hidden') {
        if (t && t.fin > Date.now()) pedirAviso({ id: t.id, fin: t.fin, nombre: t.name });
        return;
      }
      if (t && t.fin > Date.now() + 1500) cancelarAviso(t.id);
      pintar();
    };
    document.addEventListener('visibilitychange', cambio);
    return () => document.removeEventListener('visibilitychange', cambio);
  }, [pintar]);

  useEffect(() => () => parar(), []);

  return { restTimer, startTimer, skipTimer };
}
