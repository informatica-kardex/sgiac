import { useMemo } from 'react';
import { Aula, DiaSemana, HorarioAcademico } from '../../api/types';
import { Periodo } from '../../api/academico.api';
import { clockLabel, reservationDate, semesterLayout, semesterSessions, sessionColor, semesterColors, sessionKey, isAssistantSession } from '../schedule/semester';
import '../../styles/ver-horarios.css';

interface Props {
  aula: Pick<Aula, 'codigo'>; periodo: Periodo; horarios: HorarioAcademico[]; today: string;
  highlightIds?: ReadonlySet<number>;
  onCreate?: (day: DiaSemana, hour: number) => void;
  onEdit?: (session: HorarioAcademico) => void;
}
export function RoomSchedule({ aula, periodo, horarios, today, onCreate, onEdit, highlightIds }: Props) {
  const sessions = semesterSessions(horarios, aula.codigo, periodo, today);
  const colors = useMemo(() => semesterColors(horarios.filter(h => h.idPeriodo === periodo.idPeriodo)), [horarios, periodo.idPeriodo]);
  const color = (h: HorarioAcademico) => colors.get(sessionKey(h)) ?? sessionColor(h);
  const { columns, boundaries } = semesterLayout(sessions, Boolean(onEdit));
  return <section className="room-schedule" aria-label={`Horario de ${aula.codigo}`}>
    <table className="room-timetable">
      <caption>{aula.codigo} <span>— PERIODO {periodo.periodo}/{periodo.gestion}</span></caption>
      <colgroup><col className="room-time-col" />{columns.map(d => <col key={d.key} />)}</colgroup>
      <thead><tr><th scope="col">Hora</th>{columns.map(d => <th scope="col" key={d.key}>{d.label}</th>)}</tr></thead>
      <tbody>{boundaries.slice(0, -1).map((start, i) => <tr key={start} style={{ height: `${(boundaries[i + 1] - start) / (1320 - boundaries[0]) * 100}%` }}>
        <th scope="row" className="room-time">{clockLabel(start)}<span>– {clockLabel(boundaries[i + 1])}</span></th>
        {columns.map(day => {
          const block = day.blocks.find(b => b.start <= start && b.end > start);
          if (block && block.start !== start) return null;
          if (!block) return <td key={day.key} className="room-empty">{onEdit && <button type="button" className="room-slot" disabled={!onCreate} onClick={() => onCreate?.(day.key, start / 60)} aria-label={`Asignar ${day.label} ${clockLabel(start)} en ${aula.codigo}`}>+ Asignar</button>}</td>;
          return <td key={day.key} rowSpan={boundaries.indexOf(block.end) - i} className="room-occupied" style={{ backgroundColor: block.sessions.length === 1 ? color(block.sessions[0]) : undefined }}>
            <div className="room-cell-sessions">{block.sessions.map(h => {
              const title = `${h.siglas.join(' / ')} · ${h.materia} · ${h.grupo} · ${h.responsable} · ${h.horaInicio}–${h.horaFin}${h.fecha ? ` · Reservado ${reservationDate(h.fecha)} · ${h.motivo}` : ''}`;
              const content = <><strong>{isAssistantSession(h) ? 'AUX ' : ''}{h.siglas.join(' / ') || h.codigoMateria} {h.grupo === 'SIN PARALELO' ? '' : h.grupo}</strong><span>{h.responsable}</span>
                {h.fecha && <small className="room-reserved">{h.idHorarioBase ? `TRASLADO DESDE ${h.aulaOriginal}` : 'RESERVADO'} · {reservationDate(h.fecha)}</small>}
                {h.traslados?.filter(t => t.fecha >= today).map(t => <small className="room-reserved" key={t.fecha}>{reservationDate(t.fecha)}: aula {t.aula}. Resto del semestre aquí.</small>)}
                {(block.sessions.length > 1 || h.horaInicio.slice(3) !== '00' || h.horaFin.slice(3) !== '00') && <small>{h.horaInicio}–{h.horaFin}</small>}</>;
              const props = { className: `room-session${h.fecha ? ' temporary' : ''}${isAssistantSession(h) ? ' assistant' : ''}${highlightIds?.has(h.idHorario) ? ' is-search-match' : ''}`, style: { backgroundColor: color(h) }, title };
              return onEdit ? <button type="button" key={h.idHorario} {...props} onClick={() => onEdit(horarios.find(s => s.idHorario === h.idReservaOrigen) ?? h)} aria-label={`Ver asignaciones y reservar: ${title}`}>{content}</button> : <div key={h.idHorario} {...props}>{content}</div>;
            })}</div>
          </td>;
        })}
      </tr>)}</tbody>
    </table>
  </section>;
}
