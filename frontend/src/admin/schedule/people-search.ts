import type { HorarioAcademico } from '../../api/types';
import { isAssistantSession } from './semester';
import { normalizeRoomText } from './room-search';

export type PeopleFilters = { day: string; start: string; end: string; role: string; query: string };
export const EMPTY_PEOPLE_FILTERS: PeopleFilters = { day: '', start: '', end: '', role: '', query: '' };
export function searchSchedulePeople(horarios: HorarioAcademico[], periodo: string, today: string, filters: PeopleFilters) {
  const error = filters.start && filters.end && filters.start >= filters.end ? 'La hora final debe ser posterior al inicio.' : '';
  const terms = normalizeRoomText(filters.query).split(' ').filter(Boolean);
  const sessions = error ? [] : horarios.filter(h => h.idPeriodo === periodo && (!h.fecha || h.fecha >= today) &&
    (!filters.day || h.dia === filters.day) &&
    (!filters.role || isAssistantSession(h) === (filters.role === 'auxiliar')) &&
    (!filters.start || h.horaFin > filters.start) &&
    (!filters.end ? !filters.start || h.horaInicio <= filters.start : h.horaInicio < filters.end) &&
    terms.every(t => normalizeRoomText(`${h.responsable} ${h.docente} ${h.materia} ${h.siglas.join(' ')} ${h.aula}`).includes(t)))
    .sort((a,b) => a.responsable.localeCompare(b.responsable, 'es') || a.dia.localeCompare(b.dia) || a.horaInicio.localeCompare(b.horaInicio));
  return { error, sessions };
}
