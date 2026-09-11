import { useState, useCallback } from 'react';

// ═══════════════ NAVEGACIÓN ═══════════════
// Qué mes se mira, qué día está abierto y si se está en la sesión o en el
// calendario. No sabe nada del plan: solo dónde está el usuario.
export function useNavegacion({ todayISO, skipTimer }) {
  // Se arranca en la sesión de HOY: es lo que se usa el 90% del tiempo. El cursor
  // de mes sigue en el mes actual, así que la navegación no se descoloca.
  const [view, setView] = useState('session');  // session | calendar
  const [activeFecha, setActiveFecha] = useState(todayISO);
  const [activeSesion, setActiveSesion] = useState(null);   // null = la principal del día

  // Año y mes viven en UN SOLO estado. Separados, cruzar el 31 de diciembre obliga
  // a llamar a setAnio dentro del updater de setMes, y React ignora ese setState
  // (los updaters tienen que ser puros): el mes saltaba a enero y el año se quedaba
  // atrás, dejando al usuario en un mes anterior al ancla y rompiendo la pantalla.
  const [cursor, setCursor] = useState(() => ({
    anio: Number(todayISO.slice(0, 4)),
    mes: Number(todayISO.slice(5, 7)) - 1,
  }));
  const { anio, mes } = cursor;

  // ─── Navegación de mes ───
  // Aritmética en meses absolutos: cruzar diciembre deja de ser un caso especial.
  const cambiarMes = useCallback((delta) => {
    setCursor(({ anio, mes }) => {
      const total = anio * 12 + mes + delta;
      return { anio: Math.floor(total / 12), mes: ((total % 12) + 12) % 12 };
    });
  }, []);

  // ─── Navegación entre pantallas ───
  const openDay = useCallback((d) => { setActiveFecha(d.fecha); setActiveSesion(null); setView('session'); window.scrollTo(0, 0); }, []);
  const abrirSesionDelDia = useCallback((sesion) => { setActiveSesion(sesion); window.scrollTo(0, 0); }, []);
  const backToCalendar = useCallback(() => {
    if (activeSesion) { setActiveSesion(null); return; }   // de la secundaria a la principal
    setView('calendar'); skipTimer();
  }, [skipTimer, activeSesion]);

  return {
    view, activeFecha, activeSesion, anio, mes,
    cambiarMes, openDay, abrirSesionDelDia, backToCalendar,
  };
}
