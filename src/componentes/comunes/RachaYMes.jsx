import React from 'react';
import { Flame } from 'lucide-react';
import { useResumenMes } from '../../estado/useResumenMes.js';

// Racha y mes: los dos números que se miran a diario. Viven en «Hoy».
const RachaYMes = () => {
  const { stats } = useResumenMes();
  return (
    <section className="grid grid-cols-2 gap-3" aria-label="Racha y mes">
      <div className="rounded-3xl bg-tarjeta px-5 py-4">
        <div className="rotulo">Racha</div>
        <div className="flex items-center gap-2 mt-1.5">
          <Flame size={24} className={stats.racha > 0 ? 'text-ambar' : 'text-tenue'} />
          <span className="text-[32px] font-semibold text-tinta leading-none">{stats.racha}</span>
        </div>
        <p className="text-sm text-tinta3 mt-1">{stats.racha === 1 ? 'sesión seguida' : 'sesiones seguidas'}</p>
      </div>
      <div className="rounded-3xl bg-tarjeta px-5 py-4">
        <div className="rotulo">Este mes</div>
        <div className="mt-1.5 text-[32px] font-semibold text-tinta leading-none">
          {stats.completadas}<span className="text-lg text-tinta3 font-medium"> de {stats.totalEntrenables}</span>
        </div>
        <p className="text-sm text-tinta3 mt-1">Gym {stats.cats.gym}/{stats.catsTotal.gym} · Cardio {stats.cats.cardio}/{stats.catsTotal.cardio}</p>
      </div>
    </section>
  );
};

export default RachaYMes;
