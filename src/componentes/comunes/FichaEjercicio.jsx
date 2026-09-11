import React from 'react';

// Un ejercicio renderizado en modo consulta: sin checkboxes, sin inputs.
// Se usa en la biblioteca y en la ficha que se abre desde el nombre del día,
// para no duplicar la lógica de presentación de ExerciseCard.
const FichaEjercicio = ({ ex }) => (
  <div className="rounded-lg border border-[#232c34] bg-[#151b21] p-2.5">
    <div className="flex items-center gap-2 flex-wrap mb-1">
      {ex.bs && (
        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border"
          style={{
            background: ex.bstipo === 'ant' ? '#7c2d1233' : '#5b21b633',
            borderColor: ex.bstipo === 'ant' ? '#c2410c88' : '#7c3aed88',
            color: ex.bstipo === 'ant' ? '#fdba74' : '#c4b5fd',
          }}>{ex.bs}</span>
      )}
      {ex.opcional && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border border-slate-600 text-slate-400">Opcional</span>}
    </div>
    <div className="text-sm font-bold text-slate-100 leading-tight">{ex.nombre}</div>
    {ex.nota && <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{ex.nota}</p>}
    <div className="grid grid-cols-4 gap-1.5 mt-2">
      {[
        ['Series', ex.series],
        ['Reps', ex.reps],
        ex.lineal ? ['Lineal', ex.progresion] : ['RIR', ex.rir ?? '—'],
        ['Desc.', ex.descanso],
      ].map(([l, v], i) => (
        <div key={i} className="px-1.5 py-1 rounded text-center border bg-[#0f1417] border-[#232c34]">
          <div className="text-[8px] uppercase tracking-wide text-slate-600 font-semibold">{l}</div>
          <div className="text-xs font-bold text-slate-200" style={{ fontFamily: 'ui-monospace, monospace' }}>{v}</div>
        </div>
      ))}
    </div>
  </div>
);

export default FichaEjercicio;
