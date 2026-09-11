import { useState, useMemo, useCallback } from 'react';
import { generarMes, infoMes, ANCLA_DEFAULT, FESTIVOS_DEFAULT } from '../generador.js';
import { estadoGuardado } from './persistencia.js';

// ═══════════════ EL PLAN ═══════════════
// Las ENTRADAS del generador y lo que el usuario añade encima. El calendario
// no es estado: es una función pura de (ancla, fijados, festivos) fusionada
// con `extras`. Guardar el array generado sería duplicar la verdad y arriesgarse
// a que se desincronice del ancla.
//
// `borrarRegistro(fecha)` lo aporta quien tenga el progreso: cambiar la sesión
// de un día con entrenamiento registrado deja ese registro apuntando a
// ejercicios que ya no existen ahí, y hay que borrarlo (tras confirmarlo).
export function usePlan({ anio, mes, borrarRegistro }) {
  const [ancla, setAncla] = useState(() => estadoGuardado().ancla ?? ANCLA_DEFAULT);
  const [fijados, setFijados] = useState(() => estadoGuardado().fijados);   // { fecha: { turno, sesion, auto? } }
  const [festivos, setFestivos] = useState(() => estadoGuardado().festivos ?? FESTIVOS_DEFAULT);
  // Lo que el usuario añade sobre el día generado: segunda sesión y complementos.
  // Va aparte de `fijados` porque no cambia la sesión principal ni la cola de gym.
  const [extras, setExtras] = useState(() => estadoGuardado().extras ?? {});
  const [css, setCss] = useState(() => estadoGuardado().css ?? null);   // segundos por 100 m

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

  // No se puede retroceder más allá del mes del ancla: antes de esa fecha no hay
  // plan que generar y el calendario saldría vacío.
  const hayMesAnterior = useMemo(() => {
    const aAnio = Number(ancla.fecha.slice(0, 4));
    const aMes = Number(ancla.fecha.slice(5, 7)) - 1;
    return anio * 12 + mes > aAnio * 12 + aMes;
  }, [anio, mes, ancla]);

  // ─── Fijar por registro ───
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

  // ─── Editar día: FIJAR + recalcular lo que viene ───
  // El calendario se regenera solo, porque es un useMemo sobre `fijados`.
  const saveEdit = useCallback((fecha, turno, sesion, festivo, conRegistro) => {
    // Al cambiar de sesión un día con registro, ese registro apunta a ejercicios
    // que ya no existen ahí: se borra (solo tras confirmarlo en el modal).
    if (conRegistro) borrarRegistro(fecha);
    setFijados(prev => ({ ...prev, [fecha]: { turno, sesion } }));
    setFestivos(prev => festivo
      ? (prev.includes(fecha) ? prev : [...prev, fecha])
      : prev.filter(f => f !== fecha));
  }, [borrarRegistro]);

  // Soltar un día fijado: vuelve a mandar el generador
  const liberarDia = useCallback((fecha) => {
    setFijados(prev => { const n = { ...prev }; delete n[fecha]; return n; });
  }, []);

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

  // ─── Variante de la sesión (cuál de la cola toca hoy) ───
  const fijarVariante = useCallback((fecha, clave, secundaria, conRegistro) => {
    const dia = calendario.find(d => d.fecha === fecha);
    if (!dia) return;
    if (conRegistro) borrarRegistro(fecha);
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
  }, [calendario, borrarRegistro]);

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

  return {
    // estado
    ancla, fijados, festivos, extras, css,
    // derivado
    calendario, avisos, mesInfo, hayMesAnterior,
    // setters directos (los usa importar)
    setAncla, setFijados, setFestivos, setExtras, setCss,
    // mutaciones
    fijarPorRegistro, saveEdit, liberarDia,
    onSecundaria, onComplemento, fijarVariante, soltarVariante,
    onFlexible, onConvertirFlexible,
  };
}
