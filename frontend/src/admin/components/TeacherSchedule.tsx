import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Asignacion, Docente, Periodo, academicoApi, docenteLabel, LUGARES, pisoLabel } from '../../api/academico.api';
import { useBoliviaDate } from '../../hooks/useBoliviaDate';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { puedeAccederModulo } from '../../utils/roles';
import { scheduleDays, reservationDate, isAssistantSession } from '../schedule/semester';
import { Empty, ErrorNotice, Field, errorAcademico } from './AcademicoUI';
import { LoadingSpinner } from './LoadingSpinner';
import { Modal } from './Modal';

type TeacherSession = Awaited<ReturnType<typeof academicoApi.horariosDocente>>[number];
function useTeacherSchedules(id: string) {
  const [data, setData] = useState<TeacherSession[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const retry = useCallback(() => setVersion(v => v + 1), []);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setData([]);
    academicoApi.horariosDocente(id).then(rows => { if (active) setData(rows); })
      .catch(e => { if (active) setError(errorAcademico(e)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, version]);
  return { data, loading, error, retry };
}

function Sessions({ rows, periodos }: { rows: TeacherSession[]; periodos: Periodo[] }) {
  const today = useBoliviaDate();
  const { usuario } = useAdminAuth();
  const canEdit = puedeAccederModulo(usuario?.roles ?? [], 'horarios', usuario?.permisos);
  const dayIndex = (day: string) => scheduleDays.findIndex(d => d.key === day);
  const sorted = [...rows].sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? '') || dayIndex(a.dia) - dayIndex(b.dia) || a.horaInicio.localeCompare(b.horaInicio) || a.aula.localeCompare(b.aula));
  return <div className="overflow-x-auto"><table className="academic-table teacher-sessions"><thead><tr><th>DÍA / FECHA</th><th>HORA</th><th>AULA</th><th>A CARGO DE</th></tr></thead><tbody>{sorted.map(h => {
    const period = periodos.find(p => p.idPeriodo === h.idPeriodo);
    const past = Boolean(h.fecha ? h.fecha < today : period && period.fechaFin < today);
    return <tr key={h.idHorario}>
      <td><strong>{scheduleDays.find(d => d.key === h.dia)?.label ?? h.dia}</strong><p>{h.fecha ? `Reserva · ${reservationDate(h.fecha)}` : 'Clase semanal'}</p>{h.motivo && <p>{h.motivo}</p>}{past && <span className="academic-tag">Finalizada</span>}{h.estado !== 'ASIGNADO' && <span className="academic-tag">{h.estado}</span>}</td>
      <td className="whitespace-nowrap">{h.horaInicio}–{h.horaFin}</td>
      <td><strong>{h.aula}</strong><p>{LUGARES[h.lugar ?? ''] ?? 'Lugar por confirmar'} · {pisoLabel(h.piso)}</p>{canEdit && period?.estado === 'ACTIVO' && <Link className="teacher-room-link" to={`/admin/horarios?${new URLSearchParams({ aula: h.aula, periodo: h.idPeriodo })}`}>Abrir horario ↗</Link>}</td>
      <td>{h.responsable}<p>{isAssistantSession(h) ? h.idAuxiliar ? 'Auxiliar vinculado' : 'Auxiliar por designar' : h.esCoordinacion ? 'Coordinador de C.P.U.' : 'Docente'}</p></td>
    </tr>;
  })}</tbody></table></div>;
}

export function TeacherSchedule({ docente, periodos, close }: { docente: Docente; periodos: Periodo[]; close: () => void }) {
  const schedules = useTeacherSchedules(docente.idDocente);
  const [periodo, setPeriodo] = useState('');
  const periodOrder = new Map(periodos.map((p, index) => [p.idPeriodo, index]));
  const count = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`;
  const assignments = docente.asignaciones.filter(a => !periodo || a.idPeriodo === periodo)
    .sort((a, b) => (periodOrder.get(a.idPeriodo) ?? Infinity) - (periodOrder.get(b.idPeriodo) ?? Infinity) || a.materia.localeCompare(b.materia, 'es') || a.grupo.localeCompare(b.grupo));
  const rows = schedules.data.filter(h => !periodo || h.idPeriodo === periodo);
  const periods = periodos.filter(p => docente.asignaciones.some(a => a.idPeriodo === p.idPeriodo) || schedules.data.some(h => h.idPeriodo === p.idPeriodo));
  return <Modal open title="Horarios y materias del docente" size="wide" onClose={close}>
    <div className="space-y-5">
      <div className="teacher-profile"><h2>{docenteLabel(docente)}</h2><p>Consulta todas sus materias, clases y reservas, incluidos los periodos anteriores. Las auxiliarías se identifican por su responsable.</p></div>
      <Field label="Periodo del docente"><select className="select-field" value={periodo} onChange={e => setPeriodo(e.target.value)}><option value="">Todos los periodos</option>{periods.map(p => <option value={p.idPeriodo} key={p.idPeriodo}>{p.periodo}/{p.gestion}{p.estado !== 'ACTIVO' ? ' · Inactivo' : ''}</option>)}</select></Field>
      <ErrorNotice message={schedules.error} retry={schedules.retry} />
      {schedules.loading ? <LoadingSpinner /> : !schedules.error && <>
        <p role="status" className="text-sm text-slate-600">{count(new Set(assignments.map(a => a.codigoMateria)).size, 'materia', 'materias')} · {count(assignments.length, 'paralelo', 'paralelos')} · {count(rows.filter(h => !isAssistantSession(h) && !h.esCoordinacion).length, 'sesión del docente', 'sesiones del docente')} · {count(rows.filter(isAssistantSession).length, 'auxiliaría', 'auxiliarías')}{rows.some(h => h.esCoordinacion) && ` · ${count(rows.filter(h => h.esCoordinacion).length, 'sesión de C.P.U.', 'sesiones de C.P.U.')}`}</p>
        {!assignments.length ? <Empty>No hay materias asignadas en este periodo.</Empty> : assignments.map(a => <section className="teacher-subject" key={a.idAsignacion}>
          <div className="teacher-subject-heading"><h3>{a.siglas.join(' / ')} · {a.materia}</h3><p>Paralelo {a.grupo} · {a.periodo} {a.estado !== 'ACTIVO' ? '· Asignación inactiva' : ''}</p></div>
          {rows.some(h => h.idAsignacion === a.idAsignacion) ? <Sessions rows={rows.filter(h => h.idAsignacion === a.idAsignacion)} periodos={periodos} /> : <p className="p-4 text-sm text-slate-500">Materia asignada sin horarios registrados.</p>}
        </section>)}
      </>}
      <div className="flex justify-end"><button type="button" className="btn-secondary" onClick={close}>Cerrar consulta</button></div>
    </div>
  </Modal>;
}

export function RemoveTeacherAssignment({ assignment, periodos, close, removed, viewTeacher }: {
  assignment: Asignacion; periodos: Periodo[]; close: () => void; removed: () => Promise<void>; viewTeacher: () => void;
}) {
  const schedules = useTeacherSchedules(assignment.idDocente);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const linked = schedules.data.filter(h => h.idAsignacion === assignment.idAsignacion);
  async function remove() {
    if (busy || schedules.loading || schedules.error || linked.length) return;
    setBusy(true); setError('');
    try { await academicoApi.quitarAsignacion(assignment.idAsignacion); await removed(); }
    catch (e) { setError(errorAcademico(e)); schedules.retry(); }
    finally { setBusy(false); }
  }
  return <Modal open size={linked.length ? 'wide' : 'default'} title="Quitar materia del docente" onClose={() => !busy && close()}><div className="space-y-4">
    <div className="teacher-subject-heading"><h3>{assignment.materia}</h3><p>{assignment.siglas.join(' / ')} · Paralelo {assignment.grupo} · {assignment.periodo}</p><p>{assignment.docente}</p></div>
    <ErrorNotice message={error || schedules.error} retry={schedules.error ? schedules.retry : undefined} />
    {schedules.loading ? <LoadingSpinner /> : !schedules.error && (linked.length ? <>
      <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Esta materia tiene {linked.length} {linked.length === 1 ? 'horario vinculado' : 'horarios vinculados'}. Retira primero sus clases, reservas y auxiliarías para poder quitar la asignación.</p>
      <Sessions rows={linked} periodos={periodos} />
      <button type="button" className="btn-secondary" onClick={viewTeacher}>Ver todos los horarios del docente</button>
    </> : <p className="text-sm text-slate-600">¿Quieres quitar esta materia del docente? Se retirará la asignación de este paralelo y periodo. La materia y el docente seguirán registrados.</p>)}
    <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" className="btn-secondary" disabled={busy} onClick={close}>Cancelar</button><button type="button" className="btn-danger" disabled={busy || schedules.loading || Boolean(schedules.error) || linked.length > 0} onClick={() => void remove()}>{busy ? 'Quitando…' : 'Quitar materia'}</button></div>
  </div></Modal>;
}
