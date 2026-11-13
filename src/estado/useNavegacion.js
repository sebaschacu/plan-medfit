import { useState, useCallback } from 'react';

// ═══════════════ NAVEGACIÓN ═══════════════
// Qué mes se mira, qué día está abierto y en qué pantalla se está. No sabe nada
// del plan: solo dónde está el usuario.
//
// Pantallas (`view`):
//   dia       el día abierto: qué toca, sueño, segunda sesión. Con la fecha de
//             hoy es la pestaña «Hoy»; con otra, un día abierto desde el calendario.
//   session   la sesión de ese día, ejercicio a ejercicio
//   calendar · progreso · rutinas · ajustes   el resto de pestañas
export function useNavegacion({ todayISO, skipTimer }) {
  // Se arranca en HOY: es lo que se usa el 90% del tiempo.
  const [view, setView] = useState('dia');
  const [activeFecha, setActiveFecha] = useState(todayISO);
  const [activeSesion, setActiveSesion] = useState(null);   // null = la principal del día

  // Año y mes viven en UN SOLO estado. Separados, cruzar el 31 de diciembre obliga
  // a llamar a setAnio dentro del updater de setMes, y React ignora ese setState
  // (los updaters tienen que ser puros): el mes saltaba a enero y el año se quedaba
  // atrás, dejando al usuario en un mes anterior al ancla y rompiendo la pantalla.
  const mesDe = (f) => ({ anio: Number(f.slice(0, 4)), mes: Number(f.slice(5, 7)) - 1 });
  const [cursor, setCursor] = useState(() => mesDe(todayISO));
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
  const openDay = useCallback((d) => { setActiveFecha(d.fecha); setActiveSesion(null); setView('dia'); window.scrollTo(0, 0); }, []);
  // Entra en la sesión del día abierto. Sin argumento, la principal.
  const abrirSesionDelDia = useCallback((sesion) => { setActiveSesion(sesion ?? null); setView('session'); window.scrollTo(0, 0); }, []);
  // De la sesión se vuelve a su día; del día, al calendario.
  const backToCalendar = useCallback(() => {
    if (view === 'session') { setActiveSesion(null); setView('dia'); skipTimer(); window.scrollTo(0, 0); return; }
    setView('calendar');
  }, [skipTimer, view]);
  // Pestañas de la barra inferior. «hoy» vuelve además al día y al mes de hoy:
  // el calendario solo genera el mes del cursor, y sin esto «Hoy» quedaría vacío
  // después de haber mirado otro mes.
  const irA = useCallback((destino) => {
    skipTimer();
    if (destino === 'hoy') {
      setActiveFecha(todayISO); setActiveSesion(null); setCursor(mesDe(todayISO)); setView('dia');
    } else {
      // Progreso habla de AHORA (esta semana, este bloque): se mira sobre el mes de hoy.
      if (destino === 'progreso') setCursor(mesDe(todayISO));
      setView(destino);
    }
    window.scrollTo(0, 0);
  }, [todayISO, skipTimer]);

  return {
    view, activeFecha, activeSesion, anio, mes,
    cambiarMes, openDay, abrirSesionDelDia, backToCalendar, irA,
  };
}
