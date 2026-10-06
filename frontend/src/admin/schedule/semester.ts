import type { HorarioAcademico } from '../../api/types';
import type { Periodo } from '../../api/academico.api';

export const scheduleDays = [
  { key: 'LUNES', label: 'Lunes' }, { key: 'MARTES', label: 'Martes' },
  { key: 'MIERCOLES', label: 'Miércoles' }, { key: 'JUEVES', label: 'Jueves' },
  { key: 'VIERNES', label: 'Viernes' }, { key: 'SABADO', label: 'Sábado' },
] as const;
export const localDate = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);
export const minuteOf = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
export const clockLabel = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
export const reservationDate = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;

// Keep reservations through their entire local date; preserve records for history.
export function semesterSessions(horarios: HorarioAcademico[], aula: string, period: Periodo, today: string) {
  return horarios.filter(h => h.aula === aula && h.idPeriodo === period.idPeriodo &&
    (!h.fecha || (h.fecha >= today && h.fecha >= period.fechaInicio && h.fecha <= period.fechaFin)));
}

export interface ScheduleBlock { start: number; end: number; sessions: HorarioAcademico[] }
export function semesterLayout(sessions: HorarioAcademico[], editable = false) {
  const start = sessions.some(h => minuteOf(h.horaInicio) < 480) ? 420 : 480;
  const boundaries = new Set([start, 480, 600, 720, 840, 960, 1080, 1200, 1320]);
  const days = scheduleDays.filter(d => editable || d.key !== 'SABADO' || sessions.some(h => h.dia === 'SABADO'));
  // Different dates can share a time. Stack reservations, never cover one up.
  const columns = days.map(day => {
    const blocks: ScheduleBlock[] = [];
    const ordered = sessions.filter(h => h.dia === day.key).sort((a, b) =>
      minuteOf(a.horaInicio) - minuteOf(b.horaInicio) || minuteOf(a.horaFin) - minuteOf(b.horaFin) || (a.fecha ?? '').localeCompare(b.fecha ?? '') || a.idHorario - b.idHorario);
    for (const session of ordered) {
      const from = minuteOf(session.horaInicio), to = minuteOf(session.horaFin);
      const last = blocks[blocks.length - 1];
      if (last && from < last.end) { last.end = Math.max(last.end, to); last.sessions.push(session); }
      else blocks.push({ start: from, end: to, sessions: [session] });
    }
    for (const block of blocks) { boundaries.add(block.start); boundaries.add(block.end); }
    return { ...day, blocks };
  });
  return { columns, boundaries: [...boundaries].sort((a, b) => a - b) };
}

export const scheduleColors = ['#ceff47', '#5ce9ff', '#ff8be1', '#fff14a', '#c5a0ff', '#66ffb8', '#ffb264', '#86b8ff',
  '#ff9292', '#80ffe9', '#a9f867', '#ffc285', '#dda3ff', '#9aedff', '#ffb2e8', '#8bea91',
  '#f6a8c3', '#b9b1ff', '#e2ff74', '#91efdc', '#a8ceff', '#ffd978', '#b4ffd0', '#edb5ff'];
export const sessionKey = (h: HorarioAcademico) => `${h.codigoMateria}:${h.grupo}:${h.idDocente}:${h.idAuxiliar ?? ''}`;
const colorHash = (key: string) => [...key].reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 0);
export function sessionColor(h: HorarioAcademico) {
  return scheduleColors[colorHash(sessionKey(h)) % scheduleColors.length];
}
// Allocate across the whole period, so classrooms, days and printed pages agree.
// Resolve palette collisions before reusing a shade; additional classes get unique hues.
export function semesterColors(horarios: HorarioAcademico[]) {
  const colors = new Map<string, string>(), used = new Set<string>();
  for (const key of [...new Set(horarios.map(sessionKey))].sort()) {
    const hash = colorHash(key);
    let color = '';
    for (let offset = 0; offset < scheduleColors.length; offset++) {
      const candidate = scheduleColors[(hash + offset) % scheduleColors.length];
      if (!used.has(candidate)) { color = candidate; break; }
    }
    if (!color) {
      let hue = (hash % 36000) / 100;
      do {
        const lightness = (hue >= 200 && hue < 285 ? 78 : hue >= 285 || hue < 25 ? 73 : 68) + hash % 3;
        color = `hsl(${hue.toFixed(2)} 88% ${lightness}%)`; hue = (hue + 137.508) % 360;
      } while (used.has(color));
    }
    used.add(color); colors.set(key, color);
  }
  return colors;
}
