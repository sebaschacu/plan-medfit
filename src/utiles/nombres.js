import { SESION_INFO } from '../data.js';

// Los avisos del generador hablan con las claves internas («gymB», «natacion»,
// «ciclismo»). En pantalla se cambian por el nombre que ve el usuario.
const CLAVES = /\b(gym(?:A|B|D|C1|C2)|nat(?:A1|A2|A3|B1|B2|B3|CSS)|natacion|running|ciclismo|calistenia|dep_[a-z0-9]+)\b/g;
export const nombrarClaves = (texto) => String(texto ?? '').replace(CLAVES, (k) => SESION_INFO[k]?.label ?? k);
