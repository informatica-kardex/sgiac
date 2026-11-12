import type { Aula, HorarioAcademico } from '../../api/types';
import type { Periodo } from '../../api/academico.api';
import { clockLabel, minuteOf } from './semester';

export type RoomSearchFilters = {
  query: string; students: string; type: string; place: string; enabledOnly: boolean;
  day: string; start: string; end: string; date: string;
};
export const EMPTY_ROOM_SEARCH: RoomSearchFilters = { query: '', students: '', type: '', place: '', enabledOnly: true, day: '', start: '', end: '', date: '' };
export const normalizeRoomText = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
export const roomEquipment = (room: Aula) => (room.equipamiento ?? []).filter(e => e.cantidad > 0 && e.nombre.trim());
const days = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
const byCode = (a: Aula, b: Aula) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true });
export function roomSearchDay(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? days[parsed.getUTCDay()] : '';
}
function containsDay(from: string, to: string, day: string) {
  if (from > to) return false;
  const first = new Date(`${from}T00:00:00Z`);
  first.setUTCDate(first.getUTCDate() + (days.indexOf(day) - first.getUTCDay() + 7) % 7);
  return first.toISOString().slice(0, 10) <= to;
}
export type RoomAvailability = { horarios: HorarioAcademico[]; periodos: Periodo[]; periodId: string; today: string };
export type RoomCombination = { rooms: Aula[]; capacity: number; minFloor: number; maxFloor: number };
export type RoomSlot = { room: Aula; day: string; date: string; start: string; end: string; kind: 'same-day' | 'other-day' };

// One optimal option per floor/window: fewest rooms first, then least unused capacity.
// Capacity-bounded dynamic programming avoids enumerating every subset of the catalog.
function bestCombination(rooms: Aula[], requested: number): Aula[] | null {
  const largest = [...rooms].sort((a,b) => b.capacidad - a.capacidad || byCode(a,b));
  let upper = 0, maxRooms = 0;
  for (const room of largest) { upper += room.capacidad; maxRooms++; if (upper >= requested) break; }
  if (upper < requested || maxRooms < 2) return null;
  const states = new Map<number, Aula[]>([[0, []]]);
  for (const room of [...rooms].sort(byCode)) {
    for (const [capacity, selected] of [...states]) {
      const total = capacity + room.capacidad;
      if (capacity >= requested || total > upper || selected.length >= maxRooms) continue;
      const previous = states.get(total);
      if (!previous || selected.length + 1 < previous.length) states.set(total, [...selected, room]);
    }
  }
  return [...states].filter(([capacity, selected]) => capacity >= requested && selected.length >= 2)
    .sort(([capA, a], [capB, b]) => a.length - b.length || capA - capB)[0]?.[1] ?? null;
}

function nearbyCombinations(rooms: Aula[], requested: number) {
  // Pabellones groups separate buildings (E, G); equal floor numbers do not establish proximity.
  const located = rooms.filter(a => a.estado === 'disponible' && a.lugar && a.lugar !== 'PABELLONES' && a.piso !== null && Number.isInteger(a.piso));
  const options = new Map<string, RoomCombination>();
  for (const place of new Set(located.map(a => a.lugar))) {
    const inPlace = located.filter(a => a.lugar === place);
    const floors = [...new Set(inPlace.map(a => a.piso!))].sort((a,b) => a-b);
    for (const floor of floors) for (const span of [0, 1]) {
      if (span && !floors.includes(floor + 1)) continue;
      const selected = bestCombination(inPlace.filter(a => a.piso === floor || (span && a.piso === floor + 1)), requested);
      if (!selected) continue;
      const sorted = selected.sort((a,b) => a.piso! - b.piso! || byCode(a,b));
      const key = sorted.map(a => a.codigo).join('|');
      options.set(key, { rooms: sorted, capacity: sorted.reduce((total,a) => total + a.capacidad, 0), minFloor: sorted[0].piso!, maxFloor: sorted[sorted.length-1].piso! });
    }
  }
  return [...options.values()].sort((a,b) => (a.maxFloor - a.minFloor) - (b.maxFloor - b.minFloor) ||
    a.rooms.length - b.rooms.length || a.capacity - b.capacity || byCode(a.rooms[0], b.rooms[0])).slice(0, 5);
}

/** Separate unknown and insufficient capacities; neither is a match for a requested group. */
export function searchRooms(rooms: Aula[], filters: RoomSearchFilters, availability?: RoomAvailability, suggest = true) {
  const value = filters.students.trim();
  const invalidCapacity = value !== '' && (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 2000);
  const requested = !invalidCapacity && value ? Number(value) : null;
  const checkingAvailability = Boolean(filters.day || filters.start || filters.end || filters.date);
  const flexibleTime = checkingAvailability && !filters.start && !filters.end;
  const period = availability?.periodos.find(p => p.idPeriodo === availability.periodId);
  let availabilityError = '';
  if (checkingAvailability) {
    if (!days.slice(1).includes(filters.day)) availabilityError = 'Selecciona un día o una fecha para consultar disponibilidad.';
    else if (!flexibleTime && (!filters.start || !filters.end)) availabilityError = 'Completa ambas horas o déjalas vacías para ver las franjas libres del día.';
    else if (!flexibleTime && (![filters.start, filters.end].every(t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)) || filters.start < '07:00' || filters.end > '22:00' || filters.start >= filters.end)) availabilityError = 'Usa un horario entre 07:00 y 22:00, con la hora de fin posterior al inicio.';
    else if (!availability || !period || period.estado !== 'ACTIVO' || period.fechaFin < availability.today) availabilityError = 'Selecciona un periodo académico activo, vigente o futuro.';
    else if (filters.date && (!roomSearchDay(filters.date) || roomSearchDay(filters.date) !== filters.day || filters.date < availability.today || filters.date < period.fechaInicio || filters.date > period.fechaFin)) availabilityError = 'La fecha debe coincidir con el día, estar dentro del periodo y ser hoy o posterior.';
    else if (!containsDay([period.fechaInicio, availability.today].sort()[1], period.fechaFin, filters.day)) availabilityError = 'No quedan días de la semana elegida dentro de este periodo.';
  }
  const busyRooms = new Set<string>();
  const occupied = new Map<string, { start: number; end: number }[]>();
  const freeWindows = new Map<string, { start: string; end: string }[]>();
  if (checkingAvailability && !availabilityError && availability && period) {
    const periods = new Map(availability.periodos.filter(p => p.estado === 'ACTIVO').map(p => [p.idPeriodo, p]));
    for (const h of availability.horarios) {
      const other = periods.get(h.idPeriodo);
      if (!other || h.dia !== filters.day) continue;
      const from = [availability.today, period.fechaInicio, other.fechaInicio].sort()[2];
      const to = [period.fechaFin, other.fechaFin].sort()[0];
      // Overlapping active periods also occupy the room; touching time boundaries do not.
      const applies = filters.date ? filters.date >= from && filters.date <= to && (!h.fecha || h.fecha === filters.date) &&
        !(h.traslados?.some(t => t.fecha === filters.date) && !h.fecha) : h.fecha ? h.fecha >= from && h.fecha <= to : containsDay(from, to, filters.day);
      if (applies) {
        occupied.set(h.aula, [...(occupied.get(h.aula) ?? []), { start: minuteOf(h.horaInicio), end: minuteOf(h.horaFin) }]);
        if (!flexibleTime && h.horaInicio < filters.end && h.horaFin > filters.start) busyRooms.add(h.aula);
      }
    }
    for (const room of rooms) {
      let cursor = 420;
      const windows: { start: string; end: string }[] = [];
      for (const interval of (occupied.get(room.codigo) ?? []).sort((a,b) => a.start - b.start)) {
        if (interval.start > cursor) windows.push({ start: clockLabel(cursor), end: clockLabel(Math.min(interval.start, 1320)) });
        cursor = Math.max(cursor, interval.end);
      }
      if (cursor < 1320) windows.push({ start: clockLabel(cursor), end: '22:00' });
      freeWindows.set(room.codigo, windows);
      if (flexibleTime && !windows.length) busyRooms.add(room.codigo);
    }
  }
  const terms = normalizeRoomText(filters.query).split(' ').filter(Boolean);
  const candidates = rooms.filter(a => (!(checkingAvailability || filters.enabledOnly) || a.estado === 'disponible') &&
    (!filters.type || a.tipo === filters.type) && (!filters.place || a.lugar === filters.place) &&
    terms.every(term => normalizeRoomText(`${a.codigo} ${a.nombre} ${a.ubicacion ?? ''} ${a.tipo} ${roomEquipment(a).map(e => e.nombre).join(' ')}`).includes(term)));
  const matching = invalidCapacity || availabilityError ? [] : candidates.filter(a => !busyRooms.has(a.codigo));
  const known = matching.filter(a => Number.isInteger(a.capacidad) && a.capacidad > 0);
  const adequate = known.filter(a => requested === null || a.capacidad >= requested)
    .sort((a, b) => (requested === null ? 0 : a.capacidad - b.capacidad) || byCode(a, b));
  const combinations = requested !== null && !flexibleTime && !adequate.some(a => a.estado === 'disponible') ? nearbyCombinations(known, requested) : [];
  const alternatives: RoomSlot[] = [];
  if (suggest && checkingAvailability && !availabilityError && !invalidCapacity && !adequate.length && !combinations.length) {
    const duration = flexibleTime ? 60 : minuteOf(filters.end) - minuteOf(filters.start);
    const sameDay = searchRooms(rooms, { ...filters, start: '', end: '' }, availability, false);
    for (const room of sameDay.adequate) for (const window of sameDay.freeWindows.get(room.codigo) ?? []) {
      if (minuteOf(window.end) - minuteOf(window.start) < duration) continue;
      const start = Math.max(minuteOf(window.start), Math.min(minuteOf(filters.start || window.start), minuteOf(window.end) - duration));
      alternatives.push({ room, day: filters.day, date: filters.date, start: clockLabel(start), end: clockLabel(start + duration), kind: 'same-day' });
    }
    alternatives.sort((a,b) => Math.abs(minuteOf(a.start) - minuteOf(filters.start || '07:00')) - Math.abs(minuteOf(b.start) - minuteOf(filters.start || '07:00')) || byCode(a.room,b.room));
    alternatives.splice(6);
    const dayOptions = days.slice(1).filter(d => d !== filters.day).map(day => ({ day, date: '' }));
    if (filters.date) {
      dayOptions.length = 0;
      for (let offset = 1; offset <= 7; offset++) {
        const d = new Date(`${filters.date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + offset);
        const date = d.toISOString().slice(0, 10), day = roomSearchDay(date);
        if (day !== 'DOMINGO') dayOptions.push({ day, date });
      }
    }
    for (const option of dayOptions) {
      const result = searchRooms(rooms, { ...filters, ...option }, availability, false);
      for (const room of result.adequate.slice(0, 2)) {
        const window = result.freeWindows.get(room.codigo)?.find(w => minuteOf(w.end) - minuteOf(w.start) >= duration);
        if (flexibleTime && !window) continue;
        alternatives.push({ room, ...option, start: filters.start || window!.start,
          end: filters.end || clockLabel(minuteOf(window!.start) + duration), kind: 'other-day' });
      }
    }
  }
  return {
    requested, invalidCapacity, checkingAvailability, flexibleTime, availabilityError, freeWindows, alternatives,
    occupiedCount: candidates.filter(a => busyRooms.has(a.codigo)).length,
    adequate,
    combinations,
    smaller: invalidCapacity || requested === null ? [] : known.filter(a => a.capacidad < requested)
      .sort((a, b) => b.capacidad - a.capacidad || byCode(a, b)),
    unknown: matching.filter(a => !Number.isInteger(a.capacidad) || a.capacidad <= 0).sort(byCode),
  };
}
