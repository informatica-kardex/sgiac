import { useState } from 'react';
import type { HorarioAcademico } from '../../api/types';
import { EMPTY_PEOPLE_FILTERS, searchSchedulePeople } from '../schedule/people-search';
import { isAssistantSession, reservationDate, scheduleDays } from '../schedule/semester';

export function SchedulePeopleSearch({ horarios, periodo, today, disabled = false, onRoom }: {
  horarios: HorarioAcademico[]; periodo: string; today: string; disabled?: boolean; onRoom?: (code: string) => void;
}) {
  const [filters, setFilters] = useState({ ...EMPTY_PEOPLE_FILTERS });
  const active = Object.values(filters).some(Boolean);
  const { error, sessions } = searchSchedulePeople(horarios, periodo, today, filters);
  return <details className="card p-4 sm:p-5">
    <summary className="cursor-pointer font-semibold">Buscar docentes y auxiliares por día y hora</summary>
    <p className="my-3 text-sm text-slate-600">Elige un día, una hora o un intervalo. Por ejemplo: lunes, de 08:00 a 10:00. Se incluyen las clases que coinciden total o parcialmente con ese intervalo.</p>
    <fieldset disabled={disabled || !periodo} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <label className="text-sm">Día<select className="select-field mt-1" value={filters.day} onChange={e => setFilters(f => ({ ...f, day: e.target.value }))}><option value="">Todos los días</option>{scheduleDays.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}</select></label>
      <label className="text-sm">Hora o desde<input className="input-field mt-1" type="time" min="07:00" max="22:00" value={filters.start} onChange={e => setFilters(f => ({ ...f, start: e.target.value }))} /></label>
      <label className="text-sm">Hasta (opcional)<input className="input-field mt-1" type="time" min="07:00" max="22:00" value={filters.end} onChange={e => setFilters(f => ({ ...f, end: e.target.value }))} /></label>
      <label className="text-sm">Responsable<select className="select-field mt-1" value={filters.role} onChange={e => setFilters(f => ({ ...f, role: e.target.value }))}><option value="">Docentes y auxiliares</option><option value="docente">Docentes</option><option value="auxiliar">Auxiliares</option></select></label>
      <label className="text-sm">Nombre, materia o aula<input className="input-field mt-1" type="search" value={filters.query} onChange={e => setFilters(f => ({ ...f, query: e.target.value }))} /></label>
    </fieldset>
    {active && <button type="button" className="btn-ghost mt-3" onClick={() => setFilters({ ...EMPTY_PEOPLE_FILTERS })}>Limpiar filtros de personas</button>}
    {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : active && !disabled && periodo ? <>
      <p role="status" className="my-3 text-sm">{sessions.length} sesiones encontradas</p>
      <div className="max-h-96 overflow-auto"><table className="w-full text-left text-sm"><thead><tr>{['Responsable', 'Materia', 'Día y horario', 'Aula', 'Vigencia'].map(label => <th className="p-2" key={label}>{label}</th>)}</tr></thead>
        <tbody>{sessions.map(h => <tr key={h.idHorario} className="border-t border-slate-200"><td className="p-2"><strong>{h.responsable || h.docente}</strong><span className="block text-xs text-slate-500">{isAssistantSession(h) ? 'Auxiliar' : 'Docente'}</span></td>
          <td className="p-2">{h.siglas.join(' / ')} · {h.materia} · {h.grupo}</td><td className="p-2">{scheduleDays.find(d => d.key === h.dia)?.label}<span className="block whitespace-nowrap">{h.horaInicio}–{h.horaFin}</span></td>
          <td className="p-2">{onRoom ? <button type="button" className="text-blue-700 underline" onClick={() => onRoom(h.aula)}>{h.aula}</button> : h.aula}</td>
          <td className="p-2">{h.fecha ? `${h.idHorarioBase ? 'Traslado' : 'Reserva'} · ${reservationDate(h.fecha)}` : 'Todo el semestre'}{h.traslados?.filter(t => t.fecha >= today).map(t => <small key={t.fecha} className="block">Excepto {reservationDate(t.fecha)}: aula {t.aula}</small>)}</td>
        </tr>)}</tbody></table></div>
    </> : <p className="mt-3 text-sm text-slate-500">{disabled ? 'Actualizando horarios…' : !periodo ? 'Selecciona un periodo académico.' : 'Completa cualquier filtro para listar todas las coincidencias.'}</p>}
  </details>;
}
