import { FormEvent, useEffect, useRef, useState } from 'react';
import { LUGARES, pisoLabel, docenteLabel } from '../../api/academico.api';
import { horariosApi } from '../../api/horarios.api';
import { DiaSemana, HorarioAcademico } from '../../api/types';
import { ErrorNotice, Field, SaveActions, errorAcademico, useAcademico } from './AcademicoUI';
import { Modal } from './Modal';
import { AdminIcon } from './AdminIcon';
import { clockLabel, localDate, isAssistantSession, reservationDate } from '../schedule/semester';
import { filterSubjects } from '../schedule/subjects';
import { EMPTY_ROOM_SEARCH, searchRooms } from '../schedule/room-search';
export const DAYS: { key: DiaSemana; label: string }[] = [{ key:'LUNES',label:'Lunes' },{ key:'MARTES',label:'Martes' },{ key:'MIERCOLES',label:'Miércoles' },{ key:'JUEVES',label:'Jueves' },{ key:'VIERNES',label:'Viernes' },{ key:'SABADO',label:'Sábado' }];
export function plusDays(date: string, days: number) { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0,10); }
export const dayFromDate = (date: string) => DAYS[new Date(`${date}T12:00:00Z`).getUTCDay()-1]?.key;
export function monday(date: string) { return plusDays(date, -((new Date(`${date}T12:00:00Z`).getUTCDay()+6)%7)); }
export const time = (h: number) => clockLabel(Math.round(h * 60));
export const minutes = (t: string) => Number(t.slice(0,2))*60 + Number(t.slice(3,5));
function defaultEnd(start: string) { if (!/^\d{2}:\d{2}$/.test(start)) return ''; const m = Math.min(1320, minutes(start)+120); return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`; }
export interface ScheduleSeed { aula: string; dia: DiaSemana; fecha: string; hora: number; horaFin?: string; unaSesion?: boolean; temporal?: boolean; editing?: HorarioAcademico; context?: HorarioAcademico; blank?: boolean; cambiarAula?: boolean }
interface Session { aula: string; dia: DiaSemana; fecha: string; horaInicio: string; horaFin: string; reubicaciones?: { idHorario: number; aula: string }[] }
function initialSessions(seed: ScheduleSeed): Session[] {
  const h = seed.editing;
  if (!h && seed.blank) return [{ aula: seed.aula, dia: seed.dia, fecha: '', horaInicio: '', horaFin: '', reubicaciones: [] }];
  const first = { aula: h?.aula ?? seed.aula, dia: h?.dia ?? seed.dia, fecha: h?.fecha ?? seed.fecha,
    horaInicio: h?.horaInicio ?? time(seed.hora), horaFin: h?.horaFin ?? seed.horaFin ?? time(Math.min(22, seed.hora + 2)), reubicaciones: h?.reubicaciones ?? [] };
  if (h || seed.unaSesion) return [first];
  const secondDay = DAYS[(DAYS.findIndex(d => d.key === first.dia) + 2) % DAYS.length].key;
  let secondDate = first.fecha ? plusDays(first.fecha, 1) : '';
  while (secondDate && dayFromDate(secondDate) !== secondDay) secondDate = plusDays(secondDate, 1);
  return [first, { ...first, dia: secondDay, fecha: secondDate }];
}
export function HorarioForm({ c, periodo, seed, close, saved, remove, docenteId, cambiarPeriodo }: {
  c: ReturnType<typeof useAcademico>; periodo: string; seed: ScheduleSeed; close: () => void; saved: (aulas: string[]) => Promise<void>; remove: (h: HorarioAcademico) => void;
  docenteId?: string; cambiarPeriodo?: (id: string) => void;
}) {
  const [h, setEditing] = useState(seed.editing ?? null);
  const [soloAula, setSoloAula] = useState(Boolean(seed.cambiarAula));
  const firstRoom = useRef<HTMLSelectElement>(null);
  const [materia, setMateria] = useState(h?.codigoMateria ?? '');
  const [tipo, setTipo] = useState(h?.fecha || seed.temporal ? 'temporal' : 'semanal');
  const [rol, setRol] = useState(h && isAssistantSession(h) ? 'auxiliar' : 'docente');
  const [persona, setPersona] = useState(h && isAssistantSession(h) ? h.idAuxiliar ?? 'pendiente' : h?.idDocente ?? docenteId ?? '');
  const [asignacion, setAsignacion] = useState(h?.idAsignacion ?? ''), [motivo, setMotivo] = useState(h?.motivo ?? '');
  const [rows, setRows] = useState<Session[]>(() => initialSessions(seed));
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [guardado, setGuardado] = useState<string[] | null>(null);
  const nuevaTemporal = Boolean(h && !h.fecha && tipo === 'temporal');
  const today = localDate();
  const period = c.periodos.find(p => p.idPeriodo === periodo);
  useEffect(() => { if (soloAula) { firstRoom.current?.scrollIntoView({ block: 'center' }); firstRoom.current?.focus(); } }, [soloAula, h?.idHorario]);
  function editSession(session: HorarioAcademico, changeRoom = false) {
    const target = c.horarios.find(s => s.idHorario === session.idReservaOrigen) ?? session;
    setEditing(target); setSoloAula(changeRoom); setMateria(target.codigoMateria); setTipo(target.fecha ? 'temporal' : 'semanal');
    setRol(isAssistantSession(target) ? 'auxiliar' : 'docente'); setPersona(isAssistantSession(target) ? target.idAuxiliar ?? 'pendiente' : target.idDocente);
    setAsignacion(target.idAsignacion); setMotivo(target.motivo); setRows(initialSessions({ ...seed, editing: target })); setError('');
  }
  function newReservation() {
    setEditing(null); setSoloAula(false); setMateria(''); setTipo('temporal'); setRol('docente'); setPersona(docenteId ?? ''); setAsignacion(''); setMotivo('');
    setRows(initialSessions({ ...seed, aula: rows[0]?.aula ?? seed.aula, editing: undefined, blank: true })); setError('');
  }
  function sessionActions(session: HorarioAcademico) {
    const target = c.horarios.find(s => s.idHorario === session.idReservaOrigen) ?? session;
    if (target.idPeriodo !== periodo || docenteId && target.idDocente !== docenteId) return null;
    return <div className="flex shrink-0 items-center justify-end gap-2 self-end sm:self-center"><button type="button" className="btn-secondary inline-flex items-center gap-2" disabled={busy} aria-label={`Editar asignación de ${session.responsable} en ${session.aula}`} onClick={() => editSession(session)}><AdminIcon name="edit" size={16} />Editar</button><button type="button" className="btn-secondary" disabled={busy} aria-label={`Cambiar aula de ${session.responsable} en ${session.aula}`} onClick={() => editSession(session, true)}>Cambiar</button></div>;
  }
  const agenda = c.horarios.filter(s => {
    const other = c.periodos.find(p => p.idPeriodo === s.idPeriodo);
    return other?.estado === 'ACTIVO' && period && other.fechaInicio <= period.fechaFin && other.fechaFin >= period.fechaInicio;
  });
  function assignmentSummary(row: Session, index: number) {
    const day = tipo === 'temporal' ? dayFromDate(row.fecha) : row.dia;
    const ready = row.aula && day && row.horaInicio && row.horaFin && row.horaInicio < row.horaFin;
    const sessions = ready ? agenda.filter(s => s.aula === row.aula && s.dia === day &&
      s.horaInicio < row.horaFin && s.horaFin > row.horaInicio &&
      (tipo === 'temporal' ? (!s.fecha || s.fecha === row.fecha) &&
        c.periodos.some(p => p.idPeriodo === s.idPeriodo && p.fechaInicio <= row.fecha && p.fechaFin >= row.fecha) :
        !s.fecha || s.fecha >= today && s.fecha >= period!.fechaInicio && s.fecha <= period!.fechaFin)) : [];
    const weekly = sessions.filter(s => !s.fecha).sort((a, b) =>
      Number(isAssistantSession(b)) - Number(isAssistantSession(a)) || a.horaInicio.localeCompare(b.horaInicio));
    const temporary = sessions.filter(s => s.fecha).sort((a, b) =>
      a.fecha!.localeCompare(b.fecha!) || a.horaInicio.localeCompare(b.horaInicio));
    return <div key={index} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      <h4 className="text-sm font-semibold">{rows.length > 1 ? `Sesión ${index + 1} · ` : ''}{row.aula || 'Selecciona un aula'}{day && ` · ${DAYS.find(d => d.key === day)?.label}`}{tipo === 'temporal' && row.fecha && ` · ${reservationDate(row.fecha)}`}{row.horaInicio && row.horaFin && ` · ${row.horaInicio}–${row.horaFin}`}</h4>
      {!ready ? <p className="text-sm text-slate-500">Selecciona el aula, el día y el horario para ver sus asignaciones.</p> : <>
        {weekly.map(s => <div key={s.idHorario} className={`flex flex-col gap-3 rounded-md p-3 sm:flex-row sm:items-center sm:justify-between ${isAssistantSession(s) ? 'bg-slate-100' : 'bg-amber-50'}`}>
          <div className="min-w-0 flex-1">
          <p className="text-sm"><strong>{s.responsable}</strong><span className="mt-1 block text-xs font-semibold">{isAssistantSession(s) ? 'Auxiliar' : 'Docente'} · Todo el semestre</span></p>
          <p className="mt-1 text-xs text-slate-600">{s.materia} · Paralelo {s.grupo} · {s.horaInicio}–{s.horaFin}</p>
          {!isAssistantSession(s) && <p className="mt-1 text-xs text-amber-900">Este horario está ocupado por un docente.</p>}
          {s.traslados?.filter(t => tipo === 'temporal' ? t.fecha === row.fecha : t.fecha >= today && t.fecha >= period!.fechaInicio && t.fecha <= period!.fechaFin).map(t => <p key={t.fecha} className="mt-1 text-xs text-amber-900">Solo el {reservationDate(t.fecha)}: aula {t.aula}. Su asignación del semestre se conserva.</p>)}
          </div>
          {sessionActions(s)}
        </div>)}
        {temporary.length > 0 && <div className="space-y-2 border-t border-slate-200 pt-2"><h5 className="text-xs font-semibold text-slate-600">Asignaciones temporales</h5>{temporary.map(s => <div key={s.idHorario} className="flex flex-col gap-3 rounded-md border border-blue-100 bg-blue-50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
          <p className="text-sm"><strong>{s.responsable}</strong><span className="mt-1 block text-xs font-semibold">{isAssistantSession(s) ? 'Auxiliar' : 'Docente'} · {s.idHorarioBase ? 'Traslado' : 'Reserva'} · {reservationDate(s.fecha!)}</span></p>
          <p className="mt-1 text-xs text-slate-600">{s.materia} · Paralelo {s.grupo} · {s.horaInicio}–{s.horaFin}</p>
          </div>
          {sessionActions(s)}
        </div>)}</div>}
        {!sessions.length && <p className="text-sm text-slate-500">Sin asignaciones para ese día y horario.</p>}
      </>}
    </div>;
  }
  function occupants(row: Session) {
    const day = tipo === 'temporal' ? dayFromDate(row.fecha) : row.dia;
    return agenda.filter(s => s.aula === row.aula && s.dia === day && s.horaInicio < row.horaFin && s.horaFin > row.horaInicio &&
      (s.idHorario !== h?.idHorario || nuevaTemporal) && (!h || s.idReservaOrigen !== h.idHorario) &&
      (tipo === 'temporal' ? (!s.fecha || s.fecha === row.fecha) &&
        (!s.traslados?.some(t => t.fecha === row.fecha) || h?.reubicaciones?.some(r => r.idHorario === s.idHorario)) &&
        c.periodos.some(p => p.idPeriodo === s.idPeriodo && p.fechaInicio <= row.fecha && p.fechaFin >= row.fecha) : !s.fecha || s.fecha >= today));
  }
  function transfers(row: Session) { return tipo === 'temporal' && rol === 'docente' ? occupants(row).filter(s => !s.fecha && isAssistantSession(s)) : []; }
  function alternatives(base: HorarioAcademico, row: Session) {
    return searchRooms(c.aulas.filter(a => a.codigo !== row.aula), { ...EMPTY_ROOM_SEARCH, day: base.dia, date: row.fecha, start: base.horaInicio, end: base.horaFin },
      { horarios: c.horarios.filter(s => s.idHorario !== h?.idHorario && (!h || s.idReservaOrigen !== h.idHorario)), periodos: c.periodos, periodId: base.idPeriodo, today }, false);
  }
  function changeType(value: string) {
    setTipo(value); setError('');
    if (value === 'temporal' && h && !h.fecha && isAssistantSession(h)) { setRol('docente'); setPersona(h.idDocente); setAsignacion(h.idAsignacion); }
  }
  const subjects = filterSubjects(c.materias.filter(m => m.estado === 'ACTIVO' && (!docenteId || c.asignaciones.some(a => a.codigoMateria === m.codigo && a.idDocente === docenteId && a.idPeriodo === periodo && a.estado === 'ACTIVO'))), '', '');
  const subjectAssignments = c.asignaciones.filter(a => a.codigoMateria === materia && a.idPeriodo === periodo && a.estado === 'ACTIVO' &&
    subjects.some(m => m.codigo === a.codigoMateria) && c.docentes.some(d => d.idDocente === a.idDocente && d.estado === 'ACTIVO'));
  const people = (rol === 'auxiliar'
    ? [{ id: 'pendiente', nombre: 'Auxiliar por designar', assignments: subjectAssignments }, ...c.auxiliares.filter(a => a.estado === 'ACTIVO' && (!a.idEstudiante || a.cuentaActiva)).map(a => ({ id: a.idAuxiliar, nombre: a.nombreCompleto,
      assignments: subjectAssignments.filter(s => a.asignaciones.some(v => v.idAsignacion === s.idAsignacion)) }))]
    : c.docentes.filter(d => d.estado === 'ACTIVO').map(d => ({ id: d.idDocente, nombre: docenteLabel(d),
      assignments: subjectAssignments.filter(a => a.idDocente === d.idDocente) })))
    .filter(p => p.assignments.length > 0);
  const assignments = people.find(p => p.id === persona)?.assignments ?? [];
  const selectedAssignment = assignments.find(a => a.idAsignacion === asignacion);
  function selectPerson(id: string) {
    setPersona(id);
    const linked = people.find(p => p.id === id)?.assignments ?? [];
    setAsignacion(linked.length === 1 ? linked[0].idAsignacion : '');
    setError('');
  }
  function update(index: number, changes: Partial<Session>) { setRows(rows.map((row,i) => i === index ? { ...row, ...changes } : row)); }
  function addDay() {
    const last = rows[rows.length-1]; let fecha = plusDays(last.fecha || seed.fecha || period?.fechaInicio || localDate(),1); if (!dayFromDate(fecha)) fecha = plusDays(fecha,1);
    setRows([...rows, { ...last, dia: DAYS[(DAYS.findIndex(d => d.key === last.dia)+1)%6].key, fecha, reubicaciones: [] }]);
  }
  function addRoom() { const last = rows[rows.length - 1]; setRows([...rows, { ...last, aula: '', reubicaciones: [] }]); }
  async function save(e: FormEvent) {
    e.preventDefault(); setError('');
    if (!selectedAssignment) { setError('Selecciona la materia, un responsable asignado y su paralelo.'); return; }
    if (rows.some(r => !r.aula || !r.horaInicio || !r.horaFin || r.horaInicio >= r.horaFin)) { setError('Selecciona el aula y un horario válido para cada sesión.'); return; }
    if (tipo === 'temporal' && rows.some(r => !r.fecha || !dayFromDate(r.fecha))) { setError('Selecciona fechas de lunes a sábado.'); return; }
    if (rows.some(r => transfers(r).some(s => !r.reubicaciones?.some(t => t.idHorario === s.idHorario && t.aula && t.aula !== r.aula)))) { setError('Elige el aula de traslado de cada auxiliar afectado.'); return; }
    const sesiones = rows.map(r => ({ ...r, dia: tipo === 'temporal' ? dayFromDate(r.fecha)! : r.dia, fecha: tipo === 'temporal' ? r.fecha : null,
      reubicaciones: transfers(r).map(s => ({ idHorario: s.idHorario, aula: r.reubicaciones!.find(t => t.idHorario === s.idHorario)!.aula })),
      idAsignacion: asignacion, esAuxiliar: rol === 'auxiliar', idAuxiliar: rol === 'auxiliar' && persona !== 'pendiente' ? persona : null, motivo: tipo === 'temporal' ? motivo : '' }));
    setBusy(true);
    try {
      const result = h && !nuevaTemporal ? [(await horariosApi.actualizar(h.idHorario, sesiones[0])).data.data] : (await horariosApi.crearLote(sesiones)).data.data;
      const avisos = [...new Set(result.flatMap(s => s.avisos ?? []))];
      if (avisos.length) { setGuardado(avisos); await c.cargar(); } else await saved(rows.map(r => r.aula));
    }
    catch (e) { setError(errorAcademico(e)); } finally { setBusy(false); }
  }
  if (guardado) return <Modal open title="Asignación guardada" onClose={() => void saved(rows.map(r => r.aula))}><div role="status" className="space-y-4"><p>La reserva y los traslados se guardaron. Los auxiliares pueden consultar el cambio en Mi auxiliatura y en su QR.</p>{guardado.map(aviso => <p key={aviso} className="text-amber-800">{aviso}</p>)}<button type="button" className="btn-primary" onClick={() => void saved(rows.map(r => r.aula))}>Entendido</button></div></Modal>;
  const reference = !h && seed.context && rows.length === 1 && (!rows[0].fecha || !rows[0].horaInicio || !rows[0].horaFin) ? seed.context : null;
  return <Modal open size="wide" title={soloAula ? 'Cambiar aula' : h ? 'Editar sesión' : tipo === 'temporal' ? 'Nueva reserva temporal' : 'Asignar horario'} onClose={() => !busy && close()}><form onSubmit={save} className="space-y-4"><ErrorNotice message={error} />
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-4" aria-label="Asignaciones existentes del aula"><h3 className="font-semibold">Quiénes ya tienen asignada el aula</h3>
      <p className="mt-1 text-xs text-slate-500">{reference ? 'Referencia del espacio que abriste. Completa abajo los datos de la nueva reserva o elige una asignación para editarla.' : 'Solo las asignaciones del día y horario seleccionados.'}</p>
      <div className="mt-3 max-h-72 space-y-3 overflow-y-auto">{reference ? assignmentSummary({ ...reference, fecha: reference.fecha ?? seed.fecha }, 0) : rows.map(assignmentSummary)}</div>
    </section>
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{h ? soloAula ? 'Cambia el aula de esta asignación' : 'Editando la asignación seleccionada' : 'Datos de la nueva asignación'}</p>{h && <button type="button" className="btn-secondary" disabled={busy} onClick={newReservation}>Nueva reserva temporal</button>}</div>
    {h?.idHorarioBase && <p role="alert" className="text-sm text-amber-800">Este es un traslado por un día desde {h.aulaOriginal}. Para modificarlo, abre la reserva docente en el aula original. La clase semanal se conserva.</p>}
    <fieldset disabled={soloAula} className="space-y-4">
    {docenteId && <p className="font-semibold text-slate-700">{docenteLabel(c.docentes.find(d => d.idDocente === docenteId)!)}</p>}
    {cambiarPeriodo && <Field label="Periodo"><select required disabled={busy || Boolean(h)} className="select-field" value={periodo} onChange={e => cambiarPeriodo(e.target.value)}><option value="">Selecciona un periodo</option>{c.periodos.filter(p => p.estado === 'ACTIVO').map(p => <option key={p.idPeriodo} value={p.idPeriodo}>{p.periodo}/{p.gestion}</option>)}</select></Field>}
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Materia"><select required className="select-field" value={materia} onChange={e => { setMateria(e.target.value); setPersona(docenteId ?? ''); const linked = c.asignaciones.filter(a => a.codigoMateria === e.target.value && a.idDocente === docenteId && a.idPeriodo === periodo && a.estado === 'ACTIVO'); setAsignacion(linked.length === 1 ? linked[0].idAsignacion : ''); setError(''); }}><option value="">Selecciona una materia</option>{subjects.map(m => <option key={m.codigo} value={m.codigo}>{m.siglas.join(' / ')} · {m.nombre}</option>)}</select></Field>
      <Field label="Frecuencia"><select className="select-field" value={tipo} onChange={e => changeType(e.target.value)}><option value="semanal">Clase semanal durante el periodo</option><option value="temporal">Reserva temporal · fechas específicas</option></select></Field>
    </div>
    <div className="grid gap-4 md:grid-cols-[1fr_2fr]"><Field label="A cargo de"><select disabled={Boolean(docenteId)} className="select-field" value={rol} onChange={e => { setRol(e.target.value); setPersona(''); setAsignacion(''); setError(''); }}><option value="docente">Docente</option><option value="auxiliar">Auxiliar</option></select></Field>
      <Field label={rol === 'auxiliar' ? 'Auxiliar' : 'Docente'}><select required disabled={Boolean(docenteId) || !materia || !people.length} className="select-field" value={persona} onChange={e => selectPerson(e.target.value)}><option value="">{!materia ? 'Primero selecciona una materia' : `Selecciona ${rol === 'auxiliar' ? 'un auxiliar' : 'un docente'}`}</option>{people.map(p => <option key={p.id} value={p.id}>{p.nombre}{rol === 'docente' ? ` · Paralelo ${p.assignments.map(a => a.grupo).join(' / ')}` : ''}</option>)}</select></Field></div>
    {assignments.length > 1 && <Field label="Paralelo"><select required className="select-field" value={asignacion} onChange={e => setAsignacion(e.target.value)}><option value="">Selecciona un paralelo</option>{assignments.map(a => <option key={a.idAsignacion} value={a.idAsignacion}>{a.grupo} · {a.docente}</option>)}</select></Field>}
    {selectedAssignment && <p className="text-xs text-slate-500">Paralelo {selectedAssignment.grupo} · {selectedAssignment.docente}</p>}
    {materia === 'CPU' && rol === 'docente' && <p className="text-xs text-slate-600">El docente figura como coordinador del Curso Preuniversitario. Se comprueba la disponibilidad del aula; la coordinación no ocupa su agenda de clases.</p>}
    {materia && !people.length && <p className="text-sm text-amber-700">Esta materia no tiene {rol === 'auxiliar' ? 'auxiliares vinculados' : 'docentes asignados'} activos en este periodo. Registra la asignación en {rol === 'auxiliar' ? 'Auxiliares' : 'Docentes'}.</p>}
    {tipo === 'temporal' && <><Field label="Motivo de la reserva"><input required maxLength={200} className="input-field" placeholder="Examen parcial, recuperación…" value={motivo} onChange={e => setMotivo(e.target.value)} /></Field><p className="text-xs text-slate-500">La reserva y el traslado duran solo la fecha elegida. La asignación semanal del auxiliar se conserva. No se permite ocupar el horario de un docente ni otra reserva.</p>{nuevaTemporal && <p className="text-sm font-semibold text-blue-800">Se creará una reserva nueva. La sesión semanal que abriste seguirá asignada.</p>}</>}
    </fieldset>
    {soloAula && <p className="text-sm text-slate-600">Selecciona el aula de destino. Se conservarán la materia, el responsable, la fecha y el horario.</p>}
    <div className="grid items-start gap-4 md:grid-cols-2">{rows.map((row,index) => <fieldset key={index} className="min-w-0 space-y-3 rounded-lg border border-slate-200 p-4"><legend className="px-1 text-sm font-semibold text-slate-700">{tipo === 'temporal' ? 'Reserva' : 'Sesión'} {index+1}</legend>
      <Field label={`Aula · sesión ${index+1}`}><select ref={index === 0 ? firstRoom : undefined} required className="select-field" value={row.aula} onChange={e => update(index, { aula: e.target.value })}><option value="">Selecciona un aula</option>{c.aulas.filter(a => a.estado === 'disponible' || a.codigo === row.aula).map(a => <option key={a.codigo} value={a.codigo}>{a.codigo} · {LUGARES[a.lugar ?? ''] ?? 'Sin lugar'} · {pisoLabel(a.piso)}</option>)}</select></Field>
      {tipo === 'temporal' ? <Field label={`Fecha · sesión ${index+1}`}><input disabled={soloAula} required type="date" min={period?.fechaInicio} max={period?.fechaFin} className="input-field" value={row.fecha} onChange={e => update(index, { fecha: e.target.value })} /></Field> : <Field label={`Día · sesión ${index+1}`}><select disabled={soloAula} className="select-field" value={row.dia} onChange={e => update(index, { dia: e.target.value as DiaSemana })}>{DAYS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}</select></Field>}
      <div className="grid grid-cols-2 gap-3"><Field label={`Inicio · sesión ${index+1}`}><input disabled={soloAula} required type="time" min="07:00" max="21:59" step={60} className="input-field" value={row.horaInicio} onChange={e => update(index, { horaInicio: e.target.value, horaFin: defaultEnd(e.target.value) })} /></Field><Field label={`Fin · sesión ${index+1}`}><input disabled={soloAula} required type="time" min="07:01" max="22:00" step={60} className="input-field" value={row.horaFin} onChange={e => update(index, { horaFin: e.target.value })} /></Field></div>
      {occupants(row).filter(s => !transfers(row).includes(s)).length > 0 && <p role="status" className="text-sm text-amber-800">Este horario coincide con: {occupants(row).filter(s => !transfers(row).some(t => t.idHorario === s.idHorario)).map(s => `${s.responsable} (${s.horaInicio}–${s.horaFin}${s.fecha ? `, ${reservationDate(s.fecha)}` : ''})`).join('; ')}. Elige otro horario o aula.</p>}
      {transfers(row).map(base => { const libres = alternatives(base, row); return <div key={base.idHorario} className="space-y-2 rounded-lg bg-amber-50 p-3"><p className="text-sm"><strong>{base.responsable}</strong> ocupa esta aula todo el semestre. Se trasladará solo el {reservationDate(row.fecha)}, durante su sesión completa: {base.horaInicio}–{base.horaFin}.</p>
        <Field label={`Aula de traslado para ${base.responsable}`}><select required className="select-field" value={row.reubicaciones?.find(t => t.idHorario === base.idHorario)?.aula ?? ''} onChange={e => update(index, { reubicaciones: [...(row.reubicaciones ?? []).filter(t => t.idHorario !== base.idHorario), { idHorario: base.idHorario, aula: e.target.value }] })}><option value="">Elige un aula libre para ese día</option>{[...libres.adequate, ...libres.unknown].map(a => <option key={a.codigo} value={a.codigo}>{a.codigo} · {a.nombre} · {LUGARES[a.lugar ?? ''] ?? ''}</option>)}</select></Field>
        {libres.availabilityError && <p className="text-sm text-red-700">{libres.availabilityError}</p>}{!libres.adequate.length && !libres.unknown.length && <p className="text-sm">No hay aulas libres para su sesión completa. Cambia la fecha o el horario de la reserva.</p>}
        <p className="text-xs">Se notificará al auxiliar por correo y se mostrará el cambio en Mi auxiliatura y su QR.</p>
      </div>; })}
      {rows.length > 1 && <button type="button" className="text-xs text-red-600 underline" disabled={busy} onClick={() => setRows(rows.filter((_,i) => i !== index))}>Quitar este día</button>}
    </fieldset>)}</div>
    {!h && <div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary" disabled={busy || rows.length >= 24} onClick={addDay}>+ Añadir otro día</button>{tipo === 'temporal' && <button type="button" className="btn-secondary" disabled={busy || rows.length >= 24} onClick={addRoom}>+ Añadir otra aula en esta fecha</button>}</div>}
    {tipo === 'temporal' && rol === 'docente' && <p className="text-xs text-slate-500">El docente puede reservar varias aulas en la misma fecha y horario, siempre que estén disponibles. Cada reserva se conserva por separado.</p>}
    <p className="text-xs text-slate-500">Cada día puede tener un aula y horas diferentes. Se guardan juntos, únicamente si todos están disponibles.{h ? ' Estás editando solo esta sesión.' : ''}</p>
    {h && !nuevaTemporal && !h.idHorarioBase && <button type="button" className="btn-ghost text-red-600" disabled={busy} onClick={() => remove(h)}>Eliminar sesión</button>}
    <SaveActions busy={busy} close={close} disabled={!selectedAssignment || !periodo || c.loading || Boolean(c.error) || Boolean(h?.idHorarioBase)} />
  </form></Modal>;
}
