import React, { useState } from 'react';
import { ChevronRight, AlertTriangle, RotateCcw } from 'lucide-react';
import { Punto } from '../comunes/ui.jsx';
import { SESION_INFO, VARIANTES_DE, PLAN_BOGOTA, RUTINAS_GYM, SECUENCIA_GYM, claveReal } from '../../data.js';
import { useAccionesCtx, usePlanCtx } from '../../estado/contextos.js';
import { avisoAlFijar } from '../../generador.js';

// ═══════════════ SELECTOR DE VARIANTE DENTRO DEL DÍA ═══════════════
// El tipo (gym / natación / running) se elige en configuración; CUÁL de la cola toca se ve
// y se cambia aquí. Fijar una a mano no adelanta la cola: la que tocaba se hace
// en la siguiente sesión (ver POLITICA_FIJADO en generador.js).
const SelectorVariante = ({ dia, secundaria = false, registrados = 0 }) => {
  const { fijarVariante: onFijar, soltarVariante: onSoltar } = useAccionesCtx();
  const { calendario, planCfg } = usePlanCtx();
  const [abierto, setAbierto] = useState(false);
  const [porConfirmar, setPorConfirmar] = useState(null);   // clave elegida pendiente de confirmar
  const [porAvisar, setPorAvisar] = useState(null);         // { clave, avisos } · solape o S7 al fijar
  const tipo = secundaria ? dia.sesionSecundaria : dia.sesion;
  // Natación y running eligen VARIANTE dentro de su tipo; el gym, la sesión.
  // La bici solo tiene variantes desde el plan de Bogotá.
  const conVariantes = !!VARIANTES_DE[tipo] && !(tipo === 'ciclismo' && dia.fecha < PLAN_BOGOTA.desde);
  const esGym = String(tipo).startsWith('gym');
  if (!conVariantes && !esGym) return null;

  const rutina = RUTINAS_GYM[planCfg.rutinaGym] ?? RUTINAS_GYM.A;
  const opciones = conVariantes ? VARIANTES_DE[tipo]
    : (dia.fecha < PLAN_BOGOTA.desde ? SECUENCIA_GYM : [...rutina.secuencia, ...rutina.extra]);
  const actual = conVariantes
    ? claveReal(tipo, secundaria ? dia.varianteSecundaria : dia.variante)
    : tipo;
  const fijadaPorMi = conVariantes
    ? !!(secundaria ? dia.varianteFijadaSecundaria : dia.varianteFijada)
    : !!dia.fijado && !dia.fijadoAuto;
  const sugerida = conVariantes ? (secundaria ? dia.sugeridaSecundaria : dia.sugerida) : dia.sugeridaGym;
  // Los avisos solo aplican al gym: natación y running no tienen patrones que solapen
  // ni entra en S7. La secundaria tampoco se mira aquí — un gym doblado ya pasa
  // por el guardarraíl del generador, que sí ve esa colocación.
  const avisosDe = (k) => (esGym && !secundaria) ? avisoAlFijar(calendario, dia.fecha, k) : [];
  const fijar = (k) => { onFijar(dia.fecha, k, secundaria); setAbierto(false); };

  return (
    <div className="rounded-3xl bg-tarjeta">
      <button onClick={() => setAbierto(!abierto)} className="w-full min-h-[64px] px-5 py-3 flex items-center gap-3 text-left">
        <div className="flex-1 min-w-0">
          <div className="rotulo">
            {secundaria ? 'Cambiar la segunda sesión' : 'Cambiar la sesión de hoy'}
          </div>
          <div className="text-[17px] font-semibold text-tinta flex items-center gap-2 flex-wrap mt-0.5"><Punto color={SESION_INFO[actual]?.color} />
            {SESION_INFO[actual]?.label}
            <span className="text-sm font-normal text-tinta3">{SESION_INFO[actual]?.tipo}</span>
          </div>
        </div>
        {fijadaPorMi && (
          <span className="text-xs font-semibold px-2 h-6 inline-flex items-center rounded-lg text-ambar flex-shrink-0" style={{ background: 'rgba(245,158,11,0.10)' }}>
            elegida
          </span>
        )}
        <ChevronRight size={20} className={`text-mudo flex-shrink-0 transition-transform ${abierto ? 'rotate-90' : ''}`} />
      </button>

      {abierto && (
        <div className="px-4 pb-4 space-y-3">
          {/* Misma protección que el modal de edición: cambiar de sesión un día
              con entrenamiento registrado dejaría ese registro apuntando a
              ejercicios de otra sesión. Se avisa y se exige confirmar. */}
          {porConfirmar && (
            <div className="p-3.5 rounded-2xl bg-red-950/40">
              <div className="flex items-start gap-2">
                <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-100 leading-relaxed">
                  Este día ya tiene <span className="font-bold">{registrados} ejercicio(s) registrados</span>.
                  Cambiar a {SESION_INFO[porConfirmar]?.label} dejaría ese registro apuntando a ejercicios que
                  no existen ahí, así que <span className="font-bold">se borrará</span>. Tus PRs no se tocan.
                </p>
              </div>
              {/* Si además solapa o rompe S7, se dice aquí mismo: un solo paso de
                  confirmación, pero con los dos problemas delante. */}
              {avisosDe(porConfirmar).map((a, i) => (
                <p key={i} className="text-sm text-amber-200/90 leading-relaxed mt-1.5 pl-6">
                  <span className="font-bold">{a.regla === 'S7' ? 'S7 · ' : 'Solape · '}</span>{a.texto}
                </p>
              ))}
              <div className="flex gap-2 mt-3">
                <button onClick={() => setPorConfirmar(null)}
                  className="flex-1 h-12 rounded-2xl bg-elevada text-tinta text-[15px] font-semibold">
                  Cancelar
                </button>
                <button onClick={() => { onFijar(dia.fecha, porConfirmar, secundaria, true); setPorConfirmar(null); setAbierto(false); }}
                  className="flex-1 h-12 rounded-2xl bg-red-600 text-white text-[15px] font-semibold">
                  Cambiar y borrar
                </button>
              </div>
            </div>
          )}
          {/* Fijar a mano se salta las reglas del generador, que solo protege
              hacia delante. Si la elegida solapa con el gym anterior o rompe la
              separación de S7, se avisa ANTES y se exige confirmar. No se
              reescribe ningún día: la decisión sigue siendo del usuario. */}
          {porAvisar && (
            <div className="p-3.5 rounded-2xl" style={{ background: 'rgba(245,158,11,0.10)' }}>
              <div className="flex items-start gap-2">
                <AlertTriangle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <p className="text-sm font-bold text-amber-200">
                    Fijar {SESION_INFO[porAvisar.clave]?.label} aquí tiene {porAvisar.avisos.length === 1 ? 'un problema' : `${porAvisar.avisos.length} problemas`}:
                  </p>
                  {porAvisar.avisos.map((a, i) => (
                    <p key={i} className="text-sm text-amber-100/90 leading-relaxed">
                      <span className="font-bold">{a.regla === 'S7' ? 'S7 · ' : 'Solape · '}</span>{a.texto}
                    </p>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => setPorAvisar(null)} aria-label="Cancelar el cambio de sesión"
                  className="flex-1 h-12 rounded-2xl bg-elevada text-tinta text-[15px] font-semibold">
                  Mejor no
                </button>
                <button onClick={() => { fijar(porAvisar.clave); setPorAvisar(null); }} aria-label="Fijar igual"
                  className="flex-1 h-12 rounded-2xl bg-ambar text-[#0d1215] text-[15px] font-semibold">
                  Fijar igual
                </button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {opciones.map(k => {
              const activa = k === actual;
              const esSugerida = k === sugerida;
              const avisos = activa ? [] : avisosDe(k);
              const elegir = () => {
                if (k === actual) { setAbierto(false); return; }
                if (registrados > 0) { setPorConfirmar(k); return; }
                if (avisos.length) { setPorAvisar({ clave: k, avisos }); return; }
                fijar(k);
              };
              return (
                <button key={k} onClick={elegir}
                  className={`min-h-[60px] py-2.5 px-3 rounded-2xl border-2 text-left ${activa ? '' : 'border-transparent bg-elevada'}`}
                  style={activa ? { borderColor: SESION_INFO[k].color, background: SESION_INFO[k].color + '1f' } : undefined}>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Punto color={SESION_INFO[k].color} /><span className="text-[15px] font-semibold text-tinta">{SESION_INFO[k].label}</span>
                    {esSugerida && (
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md bg-fondo text-tinta2">toca</span>
                    )}
                    {avisos.length > 0 && (
                      <span aria-label={`${SESION_INFO[k].label} con aviso`}
                        className="text-xs font-semibold px-1.5 py-0.5 rounded-md text-ambar" style={{ background: 'rgba(245,158,11,0.14)' }}>
                        {avisos.some(a => a.regla === 'S7') ? 'S7' : 'solapa'}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-tinta3 leading-tight mt-0.5">{SESION_INFO[k].tipo}</div>
                </button>
              );
            })}
          </div>
          {fijadaPorMi ? (
            <button onClick={() => { onSoltar(dia.fecha, secundaria); setAbierto(false); }}
              className="w-full h-12 rounded-2xl border border-borde text-tinta2 text-[15px] font-medium flex items-center justify-center gap-2">
              <RotateCcw size={16} /> Volver a la que toca por rotación
            </button>
          ) : (
            <p className="text-sm text-tinta3 leading-relaxed">
              Elegir otra no adelanta la cola: la que tocaba se hace en la siguiente sesión, no se pierde.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default SelectorVariante;
