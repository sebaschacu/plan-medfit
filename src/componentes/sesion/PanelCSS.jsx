import React, { useState } from 'react';
import { calcularCSS, tablaRitmos, mmss } from '../../reglas.js';

// ═══════════════ CSS · TEST Y TABLA DE RITMOS ═══════════════
// Sin este número todos los ritmos del plan son adivinanzas. La tabla se enseña
// en toda sesión de agua porque en el borde de la piscina no se va calculando.
const PanelCSS = ({ css, onCSS, esTest }) => {
  const [t400, setT400] = useState('');
  const [t200, setT200] = useState('');
  const calc = (t400 && t200) ? calcularCSS(t400, t200) : null;
  const activo = css ?? calc?.segPor100 ?? null;
  const tabla = tablaRitmos(activo);

  return (
    <div className="mb-3 rounded-lg border border-cyan-900/40 bg-cyan-950/10 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-cyan-900/30">
        <div className="text-[10px] uppercase tracking-wide text-cyan-400 font-bold">
          {esTest ? 'Test de CSS' : 'Tus ritmos'}
        </div>
        {activo != null && (
          <div className="text-lg font-bold text-cyan-200 mt-0.5" style={{ fontFamily: 'ui-monospace, monospace' }}>
            CSS {mmss(activo)} <span className="text-xs font-normal text-slate-400">/ 100 m</span>
          </div>
        )}
      </div>

      {esTest && (
        <div className="px-3 py-2.5 space-y-2 border-b border-cyan-900/30">
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Apunta los dos tiempos y la app calcula tu CSS. Formato <span className="font-bold">6:40</span> o segundos.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wide text-slate-500 font-bold w-16">400 m</span>
            <input value={t400} onChange={e => setT400(e.target.value)} placeholder="6:40" aria-label="Tiempo de los 400 metros"
              className="w-20 h-8 px-2 bg-[#0f1417] border border-[#2a3540] focus:border-cyan-600 focus:outline-none text-slate-100 text-xs text-center rounded"
              style={{ fontFamily: 'ui-monospace, monospace' }} />
            <span className="text-[10px] uppercase tracking-wide text-slate-500 font-bold w-16">200 m</span>
            <input value={t200} onChange={e => setT200(e.target.value)} placeholder="3:10" aria-label="Tiempo de los 200 metros"
              className="w-20 h-8 px-2 bg-[#0f1417] border border-[#2a3540] focus:border-cyan-600 focus:outline-none text-slate-100 text-xs text-center rounded"
              style={{ fontFamily: 'ui-monospace, monospace' }} />
          </div>
          {calc?.error && <p className="text-[11px] text-red-400">{calc.error}</p>}
          {calc?.aviso && <p className="text-[11px] text-amber-300">{calc.aviso}</p>}
          {calc?.segPor100 && !calc.error && (
            <button onClick={() => onCSS(calc.segPor100)}
              className="w-full py-2 rounded-lg bg-cyan-700 text-white text-[11px] font-bold uppercase">
              Guardar CSS {mmss(calc.segPor100)}
            </button>
          )}
        </div>
      )}

      {tabla.length > 0 ? (
        <div className="px-3 py-2.5">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]" style={{ fontFamily: 'ui-monospace, monospace' }}>
              <thead>
                <tr className="text-slate-500 text-[9px] uppercase tracking-wide">
                  <th className="text-left font-bold pb-1">Ritmo</th>
                  <th className="text-right font-bold pb-1">50</th>
                  <th className="text-right font-bold pb-1">100</th>
                  <th className="text-right font-bold pb-1">200</th>
                  <th className="text-right font-bold pb-1">400</th>
                </tr>
              </thead>
              <tbody>
                {tabla.map(r => (
                  <tr key={r.clave} className={r.clave === 'CSS' ? 'text-cyan-300 font-bold' : 'text-slate-300'}>
                    <td className="py-0.5">{r.clave}</td>
                    <td className="text-right">{r.por50}</td>
                    <td className="text-right">{r.por100}</td>
                    <td className="text-right">{r.por200}</td>
                    <td className="text-right">{r.por400}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[9px] text-slate-600 mt-2 leading-relaxed">
            {tabla.find(r => r.clave === 'CSS+5')?.uso && 'CSS+5 para aeróbico sostenido · CSS−5 para series cortas. '}
            Repite el test cada 6-8 semanas: es tu métrica principal.
          </p>
        </div>
      ) : (
        <p className="px-3 py-2.5 text-[11px] text-slate-500 leading-relaxed">
          Aún no tienes CSS. Hazte el test en tu primera sesión: sin ese número, los ritmos del plan son adivinanzas.
        </p>
      )}
    </div>
  );
};

export default PanelCSS;
