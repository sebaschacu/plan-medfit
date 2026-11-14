import React from 'react';
import { Dumbbell, Home, Waves, Moon, Circle, Zap, Activity, Bike, Mountain, Trophy, Footprints } from 'lucide-react';

// Resuelve el nombre de icono que guarda SESION_INFO/TURNO_INFO al componente
// de lucide. Así data.js no importa React ni conoce la librería de iconos.
const IconFor = ({ name, size = 20, color, style }) => {
  const p = { size, color, style, strokeWidth: 2 };
  switch (name) {
    case 'dumbbell': return <Dumbbell {...p} />;
    case 'home': return <Home {...p} />;
    case 'waves': return <Waves {...p} />;
    case 'run': return <Activity {...p} />;
    case 'bike': return <Bike {...p} />;
    case 'moon': return <Moon {...p} />;
    case 'dot': return <Circle {...p} />;
    case 'mountain': return <Mountain {...p} />;
    case 'trophy': return <Trophy {...p} />;
    case 'footprints': return <Footprints {...p} />;
    default: return <Zap {...p} />;
  }
};

export default IconFor;
