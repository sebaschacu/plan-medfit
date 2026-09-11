import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { SESIONES } from './data.js';
import { generarMes, infoMes, ANCLA_DEFAULT, FESTIVOS_DEFAULT } from './generador.js';
import { calcularAvisosReset } from './reglas.js';
import {
  resolverRutina, estaEditada, guardarVersion, restaurarPlan, huerfanosDelDia,
} from './rutina.js';
import { parseRest, hoyISO } from './utiles/formato.js';
import { playBeep, vibrate } from './utiles/sonido.js';
import FichaSesion from './componentes/biblioteca/FichaSesion.jsx';
import Biblioteca from './componentes/biblioteca/Biblioteca.jsx';
import EditorRutina from './componentes/biblioteca/EditorRutina.jsx';
import CalendarView from './componentes/calendario/CalendarView.jsx';
import EditModal from './componentes/calendario/EditModal.jsx';
import SessionView from './componentes/sesion/SessionView.jsx';

// ═══════════════ CARGA DEL ESTADO GUARDADO ═══════════════
// Se lee UNA vez y de forma síncrona, para usarla en inicializadores lazy de
// useState. Antes esto vivía en un useEffect con seis setState: la app pintaba
// el estado por defecto, luego saltaba al guardado, y en StrictMode el effect
// corría dos veces. Leyéndolo aquí, el primer render ya es el bueno.
let _guardado;
function estadoGuardado() {
  if (_guardado) return _guardado;
  _guardado = { ancla: null, fijados: {}, extras: {}, css: null, rutina: {}, festivos: null, prog: {}, prs: {} };
  try {
    const raw = localStorage.getItem('plan-internado');
    if (!raw) return _guardado;
    const d = JSON.parse(raw);
    if (d.v === 3) {
      _guardado = {
        ancla: d.ancla ?? null,
        fijados: d.fijados ?? {},
        extras: d.extras ?? {},
        css: d.css ?? null,
        rutina: d.rutina ?? {},
        festivos: Array.isArray(d.festivos) ? d.festivos : null,
        prog: d.prog ?? {},
        prs: d.prs ?? {},
      };
      return _guardado;
    }
    // ── MIGRACIÓN v2 → v3 ──
    // En la v2 el progreso se indexaba por NÚMERO DE DÍA (1..31) y el calendario
    // era siempre agosto 2026. Con multi-mes ese número es ambiguo, así que las
    // claves se reindexan a fecha ISO asumiendo agosto 2026, que es lo que eran.
    const prog = {};
    for (const [k, v] of Object.entries(d.prog ?? {})) {
      const n = Number(k);
      prog[Number.isInteger(n) && n >= 1 && n <= 31
        ? `2026-08-${String(n).padStart(2, '0')}`
        : k] = v;
    }
    // El calendario v2 escrito a mano se DESCARTA: lo sustituye el generador.
    // Los festivos que hubiera marcado sí se conservan, y van al ARRAY `festivos`,
    // que es de donde los lee el generador.
    const fest = Array.isArray(d.cal)
      ? d.cal.filter(x => x.festivo && x.dia).map(x => `2026-08-${String(x.dia).padStart(2, '0')}`)
      : [];
    _guardado = {
      ancla: null,
      fijados: {},
      festivos: fest.length ? [...new Set([...FESTIVOS_DEFAULT, ...fest])] : null,
      prog,
      prs: d.prs ?? {},
    };
  } catch { /* localStorage bloqueado o JSON corrupto: se arranca de cero */ }
  return _guardado;
}

// ═══════════════ MAIN APP ═══════════════
export default function App() {
  const todayISO = hoyISO();

  // ─── Estado del generador v6 ───
  // El calendario ya NO es estado: es una función pura de (ancla, fijados, festivos).
  // Guardar el array generado sería duplicar la verdad y arriesgarse a que se
  // desincronice del ancla; lo que se persiste son las ENTRADAS.
  const [ancla, setAncla] = useState(() => estadoGuardado().ancla ?? ANCLA_DEFAULT);
  const [fijados, setFijados] = useState(() => estadoGuardado().fijados);   // { fecha: { turno, sesion, auto? } }
  const [festivos, setFestivos] = useState(() => estadoGuardado().festivos ?? FESTIVOS_DEFAULT);
  // Lo que el usuario añade sobre el día generado: segunda sesión y complementos.
  // Va aparte de `fijados` porque no cambia la sesión principal ni la cola de gym.
  const [extras, setExtras] = useState(() => estadoGuardado().extras ?? {});
  const [css, setCss] = useState(() => estadoGuardado().css ?? null);   // segundos por 100 m
  // Versiones de rutina encima del plan base. El pasado no se reescribe.
  const [rutina, setRutina] = useState(() => estadoGuardado().rutina ?? {});
  const [editandoRutina, setEditandoRutina] = useState(null);   // clave de sesión
  const [biblioteca, setBiblioteca] = useState(false);
  const [fichaSesion, setFichaSesion] = useState(null);         // clave de sesión a consultar
  // Año y mes viven en UN SOLO estado. Separados, cruzar el 31 de diciembre obliga
  // a llamar a setAnio dentro del updater de setMes, y React ignora ese setState
  // (los updaters tienen que ser puros): el mes saltaba a enero y el año se quedaba
  // atrás, dejando al usuario en un mes anterior al ancla y rompiendo la pantalla.
  const [cursor, setCursor] = useState(() => ({
    anio: Number(todayISO.slice(0, 4)),
    mes: Number(todayISO.slice(5, 7)) - 1,
  }));
  const { anio, mes } = cursor;

  const { dias: generado, avisos } = useMemo(
    () => generarMes({ anio, mes, ancla, fijados, festivos }),
    [anio, mes, ancla, fijados, festivos]
  );
  // Se fusiona lo que añadió el usuario sobre lo que produjo el generador.
  const calendario = useMemo(() => generado.map(d => {
    const ex = extras[d.fecha];
    if (!ex) return d;
    return {
      ...d,
      sesionSecundaria: ex.secundaria ?? d.sesionSecundaria,
      secundariaManual: !!ex.secundaria,
      separacionH: ex.separacionH,
      complementos: ex.complementos ?? [],
      flexRespuesta: ex.flex,
    };
  }), [generado, extras]);
  const mesInfo = useMemo(() => infoMes(anio, mes), [anio, mes]);

  const [progress, setProgress] = useState(() => estadoGuardado().prog); // { 'YYYY-MM-DD': { exId: {sets,logs} } }
  const [prMap, setPrMap] = useState(() => estadoGuardado().prs);        // { exId: {kg, flash} }
  // Se arranca en la sesión de HOY: es lo que se usa el 90% del tiempo. El cursor
  // de mes sigue en el mes actual, así que la navegación no se descoloca.
  const [view, setView] = useState('session');  // session | calendar
  const [activeFecha, setActiveFecha] = useState(todayISO);
  const [activeSesion, setActiveSesion] = useState(null);   // null = la principal del día
  // Se calcula aquí arriba porque las mutaciones de progreso lo necesitan para
  // fijar el día automáticamente al registrar la primera serie.
  const diaActivo = useMemo(() => calendario.find(d => d.fecha === activeFecha), [calendario, activeFecha]);
  const [editMode, setEditMode] = useState(false);
  const [editingDay, setEditingDay] = useState(null);
  const [restTimer, setRestTimer] = useState(null);
  const timerRef = useRef(null);

  // ─── Persistencia robusta ───
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved
  const saveTimeoutRef = useRef(null);

  // Estado serializable: se guardan las ENTRADAS del generador, no su salida.
  const snapshot = useCallback(
    () => ({ v: 3, ancla, fijados, festivos, extras, css, rutina, prog: progress, prs: prMap }),
    [ancla, fijados, festivos, extras, css, rutina, progress, prMap]
  );

  const doSave = useCallback((datos) => {
    try {
      localStorage.setItem('plan-internado', JSON.stringify(datos));
      setSaveStatus('saved');
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => setSaveStatus('idle'), 1500);
      return true;
    } catch {
      // Cuota llena o almacenamiento bloqueado (modo privado)
      setSaveStatus('error');
      return false;
    }
  }, []);

  // Guardar cada vez que cambian los datos. Ya no hace falta esperar a "la carga":
  // el estado nace leído de localStorage, así que el primer guardado normaliza
  // directamente a v3 cualquier respaldo antiguo que se haya migrado al arrancar.
  useEffect(() => { doSave(snapshot()); }, [snapshot, doSave]);

  // Guardar también cuando la app se minimiza o se cierra (red de seguridad)
  useEffect(() => {
    const flush = () => {
      try { localStorage.setItem('plan-internado', JSON.stringify(snapshot())); } catch { /* cuota llena o modo privado */ }
    };
    window.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
    };
  }, [snapshot]);

  // ─── Timer ───
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
  const skipTimer = useCallback(() => { if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null; setRestTimer(null); }, []);
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // ─── PR detector ───
  // El updater de setPrMap tiene que ser PURO. Antes llamaba a vibrate() y
  // programaba un setTimeout dentro: React invoca los updaters dos veces en
  // StrictMode, así que vibraba dos veces y dejaba dos temporizadores sueltos.
  // Es el mismo error que el de la navegación de mes. Ahora la comparación se
  // hace contra un ref y los efectos ocurren fuera del updater.
  const prMapRef = useRef(prMap);
  useEffect(() => { prMapRef.current = prMap; }, [prMap]);
  const flashRef = useRef(new Map());
  useEffect(() => () => { flashRef.current.forEach(clearTimeout); flashRef.current.clear(); }, []);

  const checkPR = useCallback((exId, kg) => {
    if (kg == null || isNaN(kg) || kg <= 0) return;
    const cur = prMapRef.current[exId];
    if (cur && kg <= cur.kg) return;
    prMapRef.current = { ...prMapRef.current, [exId]: { kg, flash: true } };
    setPrMap(prev => ({ ...prev, [exId]: { kg, flash: true } }));
    vibrate(400);
    clearTimeout(flashRef.current.get(exId));
    flashRef.current.set(exId, setTimeout(() => {
      flashRef.current.delete(exId);
      setPrMap(p => (p[exId] ? { ...p, [exId]: { ...p[exId], flash: false } } : p));
    }, 4000));
  }, []);

  // ─── Mutaciones de progreso ───
  // En cuanto se registra algo en un día, ese día queda FIJADO automáticamente.
  // Sin esto, editar otro día recalcularía el calendario y podría cambiarle la
  // sesión, dejando el registro con IDs de ejercicios que ya no existen ahí.
  // Fijarlo a su valor actual no altera nada más: la cola de gym se resincroniza
  // a la misma posición en la que ya estaba.
  const fijarPorRegistro = useCallback((dia) => {
    if (!dia) return;
    setFijados(prev => prev[dia.fecha]
      ? prev
      : {
          ...prev,
          [dia.fecha]: {
            turno: dia.turno,
            sesion: dia.sesion,
            // La VARIANTE también se fija: la natación es un tipo que resuelve a
            // natA1, natB1… Si solo se guardara el tipo, un cambio en la rotación
            // podría darle otra variante a un día ya entrenado y dejar su registro
            // (B1-3, B2-2…) apuntando a ejercicios que no están en la nueva.
            ...(dia.variante ? { variante: dia.variante } : {}),
            auto: true,
          },
        });
  }, []);

  const toggleSet = useCallback((exId, i, setCount, ex) => {
    fijarPorRegistro(diaActivo);
    setProgress(prev => {
      const day = prev[activeFecha] || {};
      const p = day[exId] || { sets: [], logs: [], lastre: null };
      const sets = [...(p.sets || [])];
      const logs = [...(p.logs || [])];
      while (sets.length < setCount) sets.push(false);
      while (logs.length < setCount) logs.push(null);
      const nv = !sets[i];
      sets[i] = nv;
      if (nv && !timerRef.current && ex) { const r = parseRest(ex.descanso); if (r) startTimer(r, ex.nombre); }
      return { ...prev, [activeFecha]: { ...day, [exId]: { ...p, sets, logs } } };
    });
  }, [activeFecha, startTimer, fijarPorRegistro, diaActivo]);

  const onLog = useCallback((exId, i, log, setCount) => {
    fijarPorRegistro(diaActivo);
    setProgress(prev => {
      const day = prev[activeFecha] || {};
      const p = day[exId] || { sets: [], logs: [], lastre: null };
      const logs = [...(p.logs || [])];
      while (logs.length < setCount) logs.push(null);
      logs[i] = log;
      return { ...prev, [activeFecha]: { ...day, [exId]: { ...p, logs } } };
    });
    if (log?.kg != null) checkPR(exId, log.kg);
  }, [activeFecha, checkPR, fijarPorRegistro, diaActivo]);

  const onLastre = useCallback((exId, kg) => {
    fijarPorRegistro(diaActivo);
    setProgress(prev => {
      const day = prev[activeFecha] || {};
      const p = day[exId] || { sets: [], logs: [], lastre: null };
      return { ...prev, [activeFecha]: { ...day, [exId]: { ...p, lastre: kg } } };
    });
    if (kg != null) checkPR(exId, kg);
  }, [activeFecha, checkPR, fijarPorRegistro, diaActivo]);

  // Rellena la carga sugerida en las series que aún no tienen kg anotados.
  // Nunca sobrescribe lo que ya registraste: la sugerencia sigue siendo editable.
  const usarSugerido = useCallback((exId, kg, setCount) => {
    fijarPorRegistro(diaActivo);
    setProgress(prev => {
      const day = prev[activeFecha] || {};
      const p = day[exId] || { sets: [], logs: [], lastre: null };
      const logs = [...(p.logs || [])];
      while (logs.length < setCount) logs.push(null);
      for (let i = 0; i < setCount; i++) {
        if (logs[i]?.kg == null) logs[i] = { ...(logs[i] ?? {}), kg };
      }
      return { ...prev, [activeFecha]: { ...day, [exId]: { ...p, logs } } };
    });
    checkPR(exId, kg);
  }, [activeFecha, checkPR, fijarPorRegistro, diaActivo]);

  const onBanda = useCallback((exId, val) => {
    fijarPorRegistro(diaActivo);
    setProgress(prev => {
      const day = prev[activeFecha] || {};
      const p = day[exId] || { sets: [], logs: [], lastre: null };
      return { ...prev, [activeFecha]: { ...day, [exId]: { ...p, banda: val } } };
    });
  }, [activeFecha, fijarPorRegistro, diaActivo]);

  const resetDay = useCallback(() => {
    setProgress(prev => { const n = { ...prev }; delete n[activeFecha]; return n; });
  }, [activeFecha]);

  // ─── Editar día: FIJAR + recalcular lo que viene ───
  // El calendario se regenera solo, porque es un useMemo sobre `fijados`.
  const saveEdit = useCallback((fecha, turno, sesion, festivo, borrarRegistro) => {
    // Al cambiar de sesión un día con registro, ese registro apunta a ejercicios
    // que ya no existen ahí: se borra (solo tras confirmarlo en el modal).
    if (borrarRegistro) setProgress(prev => { const n = { ...prev }; delete n[fecha]; return n; });
    setFijados(prev => ({ ...prev, [fecha]: { turno, sesion } }));
    setFestivos(prev => festivo
      ? (prev.includes(fecha) ? prev : [...prev, fecha])
      : prev.filter(f => f !== fecha));
    setEditingDay(null);
  }, []);

  // Soltar un día fijado: vuelve a mandar el generador
  const liberarDia = useCallback((fecha) => {
    setFijados(prev => { const n = { ...prev }; delete n[fecha]; return n; });
    setEditingDay(null);
  }, []);

  // ─── Sueño en posturno (regla S4) ───
  const onSueno = useCallback((h) => {
    setProgress(prev => ({ ...prev, [activeFecha]: { ...(prev[activeFecha] || {}), __sueno: h } }));
  }, [activeFecha]);

  // ─── Avisos de reset (regla P6) ───
  const avisosReset = useMemo(() => calcularAvisosReset(progress, SESIONES), [progress]);

  // ─── Exportar / importar JSON ───
  const [mensajeDatos, setMensajeDatos] = useState(null);
  const avisar = useCallback((ok, texto) => {
    setMensajeDatos({ ok, texto });
    setTimeout(() => setMensajeDatos(null), 5000);
  }, []);

  const onExportar = useCallback(() => {
    try {
      const blob = new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `plan-internado-${todayISO}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      avisar(true, 'Exportado. Pásalo al otro dispositivo e impórtalo allí.');
    } catch {
      avisar(false, 'No se pudo exportar en este navegador.');
    }
  }, [snapshot, todayISO, avisar]);

  const onImportar = useCallback((file) => {
    const lector = new FileReader();
    lector.onload = () => {
      try {
        const d = JSON.parse(String(lector.result));
        // Validación mínima: debe parecer un respaldo de esta app, no un JSON cualquiera.
        if (!d || typeof d !== 'object' || (!d.prog && !d.fijados && !d.ancla)) {
          avisar(false, 'Ese archivo no parece un respaldo de la app.');
          return;
        }
        // Se restaura TODO lo que exporta snapshot(). Si aquí falta un campo,
        // importar un respaldo lo borra en silencio en el dispositivo destino.
        const obj = x => (x && typeof x === 'object' && !Array.isArray(x) ? x : null);
        if (d.ancla) setAncla(d.ancla);
        setFijados(obj(d.fijados) ?? {});
        setFestivos(Array.isArray(d.festivos) ? d.festivos : FESTIVOS_DEFAULT);
        setExtras(obj(d.extras) ?? {});
        setCss(typeof d.css === 'number' && d.css > 0 ? d.css : null);   // seg/100 m
        setRutina(obj(d.rutina) ?? {});
        setProgress(obj(d.prog) ?? {});
        setPrMap(obj(d.prs) ?? {});
        const nDias = Object.keys(obj(d.prog) ?? {}).length;
        const nRut = Object.keys(obj(d.rutina) ?? {}).length;
        avisar(true, `Importado: ${nDias} ${nDias === 1 ? 'día' : 'días'} con registro`
          + (nRut ? `, ${nRut} ${nRut === 1 ? 'rutina editada' : 'rutinas editadas'}` : '')
          + (typeof d.css === 'number' && d.css > 0 ? ', CSS incluido' : '') + '.');
      } catch {
        avisar(false, 'El archivo está corrupto o no es JSON válido.');
      }
    };
    lector.onerror = () => avisar(false, 'No se pudo leer el archivo.');
    lector.readAsText(file);
  }, [avisar]);

  // ─── Segunda sesión y complementos ───
  const setExtra = useCallback((fecha, cambio) => {
    setExtras(prev => {
      const actual = prev[fecha] ?? {};
      const nuevo = { ...actual, ...cambio };
      // Si queda vacío se elimina la entrada, para no guardar basura
      const vacio = !nuevo.secundaria && !(nuevo.complementos?.length) && nuevo.separacionH == null && !nuevo.flex;
      const out = { ...prev };
      if (vacio) delete out[fecha]; else out[fecha] = nuevo;
      return out;
    });
  }, []);

  const onSecundaria = useCallback((fecha, sesion, separacionH) =>
    setExtra(fecha, { secundaria: sesion || undefined, separacionH }), [setExtra]);

  const onComplemento = useCallback((fecha, comp, activo) => {
    setExtras(prev => {
      const actual = prev[fecha] ?? {};
      const lista = new Set(actual.complementos ?? []);
      if (activo) lista.add(comp); else lista.delete(comp);
      const nuevo = { ...actual, complementos: [...lista] };
      const vacio = !nuevo.secundaria && !nuevo.complementos.length && nuevo.separacionH == null && !nuevo.flex;
      const out = { ...prev };
      if (vacio) delete out[fecha]; else out[fecha] = nuevo;
      return out;
    });
  }, []);

  // ─── Editor de rutina ───
  const guardarRutina = useCallback((sesionKey, ejercicios, motivo) => {
    setRutina(prev => guardarVersion(prev, sesionKey, ejercicios, todayISO, motivo));
    setEditandoRutina(null);
  }, [todayISO]);
  const restaurarRutina = useCallback((sesionKey) => {
    setRutina(prev => restaurarPlan(prev, sesionKey, todayISO));
    setEditandoRutina(null);
  }, [todayISO]);

  // ─── Variante de la sesión (cuál de la cola toca hoy) ───
  const fijarVariante = useCallback((fecha, clave, secundaria, borrarRegistro) => {
    const dia = calendario.find(d => d.fecha === fecha);
    if (!dia) return;
    if (borrarRegistro) setProgress(prev => { const n = { ...prev }; delete n[fecha]; return n; });
    setFijados(prev => {
      const act = prev[fecha] ?? { turno: dia.turno, sesion: dia.sesion };
      // Natación: el TIPO no cambia, cambia la variante. Gym: cambia la sesión.
      const esNat = (secundaria ? dia.sesionSecundaria : dia.sesion) === 'natacion';
      if (esNat) {
        return { ...prev, [fecha]: { ...act, turno: dia.turno, sesion: dia.sesion,
          [secundaria ? 'varianteSecundaria' : 'variante']: clave } };
      }
      return { ...prev, [fecha]: { ...act, turno: dia.turno, sesion: clave } };
    });
  }, [calendario]);

  const soltarVariante = useCallback((fecha, secundaria) => {
    setFijados(prev => {
      const act = prev[fecha];
      if (!act) return prev;
      const resto = { ...act };
      delete resto[secundaria ? 'varianteSecundaria' : 'variante'];
      const quedaAlguna = !!(resto.variante || resto.varianteSecundaria);
      const out = { ...prev };
      if (quedaAlguna) { out[fecha] = resto; return out; }
      // Ya no queda ninguna variante elegida a mano:
      //  · si el día tiene registro, se conserva el auto-fijado (protege el historial)
      //  · si no, se suelta del todo para que vuelva a mandar la rotación
      if (act.auto) out[fecha] = { turno: act.turno, sesion: act.sesion, auto: true };
      else delete out[fecha];
      return out;
    });
  }, []);

  // ─── Día flexible ───
  const onFlexible = useCallback((fecha, cambio) => {
    setExtras(prev => ({ ...prev, [fecha]: { ...(prev[fecha] ?? {}), flex: { ...(prev[fecha]?.flex ?? {}), ...cambio } } }));
  }, []);
  // Convertirlo en running es fijar ese día: el generador lo respetará al recalcular
  const onConvertirFlexible = useCallback((fecha, sesion) => {
    setFijados(prev => ({ ...prev, [fecha]: { ...(prev[fecha] ?? {}), turno: 'C', sesion } }));
  }, []);

  // ─── Navegación de mes ───
  // Aritmética en meses absolutos: cruzar diciembre deja de ser un caso especial.
  const cambiarMes = useCallback((delta) => {
    setCursor(({ anio, mes }) => {
      const total = anio * 12 + mes + delta;
      return { anio: Math.floor(total / 12), mes: ((total % 12) + 12) % 12 };
    });
  }, []);

  // No se puede retroceder más allá del mes del ancla: antes de esa fecha no hay
  // plan que generar y el calendario saldría vacío.
  const hayMesAnterior = useMemo(() => {
    const aAnio = Number(ancla.fecha.slice(0, 4));
    const aMes = Number(ancla.fecha.slice(5, 7)) - 1;
    return anio * 12 + mes > aAnio * 12 + aMes;
  }, [anio, mes, ancla]);

  // ─── Navegación ───
  const openDay = useCallback((d) => { setActiveFecha(d.fecha); setActiveSesion(null); setView('session'); window.scrollTo(0, 0); }, []);
  const abrirSesionDelDia = useCallback((sesion) => { setActiveSesion(sesion); window.scrollTo(0, 0); }, []);
  const backToCalendar = useCallback(() => {
    if (activeSesion) { setActiveSesion(null); return; }   // de la secundaria a la principal
    setView('calendar'); skipTimer();
  }, [skipTimer, activeSesion]);

  const activeDiaData = diaActivo;

  // Clave real de la sesión que se está viendo (natación resuelve a su variante)
  const claveVista = activeDiaData && (activeSesion
    ? (activeSesion === 'natacion' ? (activeDiaData.varianteSecundaria ?? 'natacion') : activeSesion)
    : (activeDiaData.sesion === 'natacion' ? (activeDiaData.variante ?? 'natacion') : activeDiaData.sesion));
  const ejerciciosVigentes = claveVista ? resolverRutina(claveVista, activeFecha, rutina) : null;

  if (fichaSesion) {
    return (
      <FichaSesion sesionKey={fichaSesion}
        ejercicios={resolverRutina(fichaSesion, todayISO, rutina)}
        onCerrar={() => setFichaSesion(null)} />
    );
  }

  if (biblioteca) {
    return <Biblioteca onAbrir={setFichaSesion} onCerrar={() => setBiblioteca(false)} />;
  }

  if (editandoRutina) {
    return (
      <EditorRutina
        sesionKey={editandoRutina}
        ejercicios={resolverRutina(editandoRutina, todayISO, rutina)}
        editada={estaEditada(editandoRutina, todayISO, rutina)}
        onGuardar={(ejs, motivo) => guardarRutina(editandoRutina, ejs, motivo)}
        onRestaurar={() => restaurarRutina(editandoRutina)}
        onCerrar={() => setEditandoRutina(null)}
      />
    );
  }

  // Si por lo que sea no hay día activo (mes cambiado, fecha fuera de rango),
  // se cae al calendario en lugar de dejar la pantalla vacía.
  if (view === 'session' && !activeDiaData) {
    return (
      <>
        <CalendarView
          calendario={calendario} progress={progress} avisos={avisos}
          onOpenDay={openDay} onEditDay={setEditingDay}
          editMode={editMode} setEditMode={setEditMode} todayISO={todayISO}
          saveStatus={saveStatus} mesInfo={mesInfo} onMes={cambiarMes} hayMesAnterior={hayMesAnterior} rutina={rutina}
          onExportar={onExportar} onImportar={onImportar} mensajeDatos={mensajeDatos}
          onBiblioteca={() => setBiblioteca(true)} prMap={prMap}
        />
        {editingDay && (
          <EditModal
            dia={editingDay} onSave={saveEdit} onLiberar={liberarDia} onClose={() => setEditingDay(null)}
            ejerciciosRegistrados={Object.keys(progress[editingDay.fecha] || {}).filter(k => !k.startsWith('__')).length}
          />
        )}
      </>
    );
  }

  if (view === 'session' && activeDiaData) {
    return (
      <>
        <SessionView
          diaData={activeDiaData} sesionKey={claveVista}
          ejerciciosVigentes={ejerciciosVigentes}
          huerfanos={huerfanosDelDia(progress[activeFecha] ?? {}, ejerciciosVigentes ?? [])}
          onEditarRutina={setEditandoRutina}
          rutinaEditada={estaEditada(claveVista, todayISO, rutina)}
          esSecundaria={!!activeSesion}
          onSecundaria={onSecundaria} onComplemento={onComplemento} onAbrirSesion={abrirSesionDelDia}
          css={css} onCSS={setCss}
          onFlexible={onFlexible} onConvertirFlexible={onConvertirFlexible}
          onFijarVariante={fijarVariante} onSoltarVariante={soltarVariante}
          onVerFicha={setFichaSesion} progresoTotal={progress} onUsarSugerido={usarSugerido}
          progress={progress[activeFecha]} prMap={prMap}
          onBack={backToCalendar} onToggleSet={toggleSet} onLog={onLog} onLastre={onLastre} onBanda={onBanda}
          onReset={resetDay} restTimer={restTimer} onSkipTimer={skipTimer}
          avisosReset={avisosReset} onSueno={onSueno}
        />
      </>
    );
  }

  return (
    <>
      <CalendarView
        calendario={calendario} progress={progress} avisos={avisos}
        onOpenDay={openDay} onEditDay={setEditingDay}
        editMode={editMode} setEditMode={setEditMode} todayISO={todayISO}
        saveStatus={saveStatus} mesInfo={mesInfo} onMes={cambiarMes} hayMesAnterior={hayMesAnterior} rutina={rutina}
        onExportar={onExportar} onImportar={onImportar} mensajeDatos={mensajeDatos}
        onBiblioteca={() => setBiblioteca(true)} prMap={prMap}
      />
      {editingDay && (
        <EditModal
          dia={editingDay} onSave={saveEdit} onLiberar={liberarDia} onClose={() => setEditingDay(null)}
          ejerciciosRegistrados={Object.keys(progress[editingDay.fecha] || {}).filter(k => !k.startsWith('__')).length}
        />
      )}
    </>
  );
}
