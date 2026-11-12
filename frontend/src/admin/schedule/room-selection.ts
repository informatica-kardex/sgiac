import type { Aula } from '../../api/types';
import { LUGARES } from '../../api/academico.api';

export function selectedRooms<T extends Pick<Aula, 'codigo' | 'lugar' | 'piso'>>(aulas: T[], lugar: string | null, piso: string | null) {
  const order = Object.keys(LUGARES);
  return aulas.filter(a => lugar !== null && piso !== null && (!lugar || a.lugar === lugar) && (!piso || String(a.piso) === piso))
    .sort((a, b) => order.indexOf(a.lugar ?? '') - order.indexOf(b.lugar ?? '') ||
      (a.piso ?? -99) - (b.piso ?? -99) || a.codigo.localeCompare(b.codigo, 'es', { numeric: true }));
}
