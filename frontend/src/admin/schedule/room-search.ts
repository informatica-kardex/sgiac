import type { Aula } from '../../api/types';

export type RoomSearchFilters = {
  query: string; students: string; type: string; place: string; equipment: string; enabledOnly: boolean;
};
export const EMPTY_ROOM_SEARCH: RoomSearchFilters = { query: '', students: '', type: '', place: '', equipment: '', enabledOnly: true };
export const normalizeRoomText = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
export const roomEquipment = (room: Aula) => (room.equipamiento ?? []).filter(e => e.cantidad > 0 && e.nombre.trim());

/** Separate unknown and insufficient capacities; neither is a match for a requested group. */
export function searchRooms(rooms: Aula[], filters: RoomSearchFilters) {
  const value = filters.students.trim();
  const invalidCapacity = value !== '' && (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 2000);
  const requested = !invalidCapacity && value ? Number(value) : null;
  const terms = normalizeRoomText(filters.query).split(' ').filter(Boolean);
  const matching = rooms.filter(a => (!filters.enabledOnly || a.estado === 'disponible') &&
    (!filters.type || a.tipo === filters.type) && (!filters.place || a.lugar === filters.place) &&
    (!filters.equipment || roomEquipment(a).some(e => normalizeRoomText(e.nombre) === filters.equipment)) &&
    terms.every(term => normalizeRoomText(`${a.codigo} ${a.nombre} ${a.ubicacion ?? ''} ${a.tipo} ${roomEquipment(a).map(e => e.nombre).join(' ')}`).includes(term)));
  const byCode = (a: Aula, b: Aula) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true });
  const known = matching.filter(a => Number.isFinite(a.capacidad) && a.capacidad > 0);
  return {
    requested, invalidCapacity,
    adequate: invalidCapacity ? [] : known.filter(a => requested === null || a.capacidad >= requested)
      .sort((a, b) => (requested === null ? 0 : a.capacidad - b.capacidad) || byCode(a, b)),
    smaller: invalidCapacity || requested === null ? [] : known.filter(a => a.capacidad < requested)
      .sort((a, b) => b.capacidad - a.capacidad || byCode(a, b)),
    unknown: invalidCapacity ? [] : matching.filter(a => !Number.isFinite(a.capacidad) || a.capacidad <= 0).sort(byCode),
  };
}
