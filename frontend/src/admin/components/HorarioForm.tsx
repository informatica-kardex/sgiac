import { FormEvent, useState } from 'react';
import { LUGARES, pisoLabel, docenteLabel } from '../../api/academico.api';
import { horariosApi } from '../../api/horarios.api';
import { DiaSemana, HorarioAcademico } from '../../api/types';
import { ErrorNotice, Field, SaveActions, errorAcademico, useAcademico } from './AcademicoUI';
import { Modal } from './Modal';
import { clockLabel, localDate, isAssistantSession } from '../schedule/semester';
import { filterSubjects } from '../schedule/subjects';
export const DAYS: { key: DiaSemana; label: string }[] = [{ key:'LUNES',label:'Lunes' },{ key:'MARTES',label:'Martes' },{ key:'MIERCOLES',label:'Miércoles' },{ key:'JUEVES',label:'Jueves' },{ key:'VIERNES',label:'Viernes' },{ key:'SABADO',label:'Sábado' }];
export function plusDays(date: string, days: number) { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0,10); }
export const dayFromDate = (date: string) => DAYS[new Date(`${date}T12:00:00Z`).getUTCDay()-1]?.key;
export function monday(date: string) { return plusDays(date, -((new Date(`${date}T12:00:00Z`).getUTCDay()+6)%7)); }
export const time = (h: number) => clockLabel(Math.round(h * 60));
export const minutes = (t: string) => Number(t.slice(0,2))*60 + Number(t.slice(3,5));
function defaultEnd(start: string) { if (!/^\d{2}:\d{2}$/.test(start)) return ''; const m = Math.min(1320, minutes(start)+120); return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`; }
export interface ScheduleSeed { aula: string; dia: DiaSemana; fecha: string; hora: number; horaFin?: string; unaSesion?: boolean; temporal?: boolean; editing?: HorarioAcademico }
interface Session { aula: string; dia: DiaSemana; fecha: string; horaInicio: string; horaFin: string }
function initialSessions(seed: ScheduleSeed): Session[] {
  const h = seed.editing;
  const first = { aula: h?.aula ?? seed.aula, dia: h?.dia ?? seed.dia, fecha: h?.fecha ?? seed.fecha,
    horaInicio: h?.horaInicio ?? time(seed.hora), horaFin: h?.horaFin ?? seed.horaFin ?? time(Math.min(22, seed.hora + 2)) };
  if (h || seed.unaSesion) return [first];
  const secondDay = DAYS[(DAYS.findIndex(d => d.key === first.dia) + 2) % DAYS.length].key;
  let secondDate = first.fecha ? plusDays(first.fecha, 1) : '';
  while (secondDate && dayFromDate(secondDate) !== secondDay) secondDate = plusDays(secondDate, 1);
  return [first, { ...first, dia: secondDay, fecha: secondDate }];
}
export function HorarioForm({ c, periodo, seed, close, saved, remove }: {
  c: ReturnType<typeof useAcademico>; periodo: string; seed: ScheduleSeed; close: () => void; saved: (aulas: string[]) => Promise<void>; remove: (h: HorarioAcademico) => void;
}) {
  const h = seed.editing;
  const [materia, setMateria] = useState(h?.codigoMateria ?? '');
  const [tipo, setTipo] = useState(h?.fecha || seed.temporal ? 'temporal' : 'semanal');
  const [rol, setRol] = useState(h && isAssistantSession(h) ? 'auxiliar' : 'docente');
  const [persona, setPersona] = useState(h && isAssistantSession(h) ? h.idAuxiliar ?? 'pendiente' : h?.idDocente ?? '');
  const [asignacion, setAsignacion] = useState(h?.idAsignacion ?? ''), [motivo, setMotivo] = useState(h?.motivo ?? '');
  const [rows, setRows] = useState<Session[]>(() => initialSessions(seed));
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const period = c.periodos.find(p => p.idPeriodo === periodo);
  const subjects = filterSubjects(c.materias.filter(m => m.estado === 'ACTIVO'), '', '');
  const subjectAssignments = c.asignaciones.filter(a => a.codigoMateria === materia && a.idPeriodo === periodo && a.estado === 'ACTIVO' &&
    subjects.some(m => m.codigo === a.codigoMateria) && c.docentes.some(d => d.idDocente === a.idDocente && d.estado === 'ACTIVO'));
  const people = (rol === 'auxiliar'
    ? [{ id: 'pendiente', nombre: 'Auxiliar por designar', assignments: subjectAssignments }, ...c.auxiliares.filter(a => a.estado === 'ACTIVO').map(a => ({ id: a.idAuxiliar, nombre: a.nombreCompleto,
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
    setRows([...rows, { ...last, dia: DAYS[(DAYS.findIndex(d => d.key === last.dia)+1)%6].key, fecha }]);
  }
  async function save(e: FormEvent) {
    e.preventDefault(); setError('');
    if (!selectedAssignment) { setError('Selecciona la materia, un responsable asignado y su paralelo.'); return; }
    if (rows.some(r => r.horaInicio >= r.horaFin)) { setError('La hora final debe ser posterior al inicio en todas las sesiones.'); return; }
    if (tipo === 'temporal' && rows.some(r => !r.fecha || !dayFromDate(r.fecha))) { setError('Selecciona fechas de lunes a sábado.'); return; }
    const sesiones = rows.map(r => ({ ...r, dia: tipo === 'temporal' ? dayFromDate(r.fecha)! : r.dia, fecha: tipo === 'temporal' ? r.fecha : null,
      idAsignacion: asignacion, esAuxiliar: rol === 'auxiliar', idAuxiliar: rol === 'auxiliar' && persona !== 'pendiente' ? persona : null, motivo: tipo === 'temporal' ? motivo : '' }));
    setBusy(true);
    try { if (h) await horariosApi.actualizar(h.idHorario, sesiones[0]); else await horariosApi.crearLote(sesiones); await saved(rows.map(r => r.aula)); }
    catch (e) { setError(errorAcademico(e)); } finally { setBusy(false); }
  }
  return <Modal open size="wide" title={h ? 'Editar sesión' : 'Asignar horario'} onClose={() => !busy && close()}><form onSubmit={save} className="space-y-4"><ErrorNotice message={error} />
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Materia"><select required className="select-field" value={materia} onChange={e => { setMateria(e.target.value); setPersona(''); setAsignacion(''); setError(''); }}><option value="">Selecciona una materia</option>{subjects.map(m => <option key={m.codigo} value={m.codigo}>{m.siglas.join(' / ')} · {m.nombre}</option>)}</select></Field>
      <Field label="Frecuencia"><select className="select-field" value={tipo} onChange={e => setTipo(e.target.value)}><option value="semanal">Clase semanal durante el periodo</option><option value="temporal">Reserva temporal · fechas específicas</option></select></Field>
    </div>
    <div className="grid gap-4 md:grid-cols-[1fr_2fr]"><Field label="A cargo de"><select className="select-field" value={rol} onChange={e => { setRol(e.target.value); setPersona(''); setAsignacion(''); setError(''); }}><option value="docente">Docente</option><option value="auxiliar">Auxiliar</option></select></Field>
      <Field label={rol === 'auxiliar' ? 'Auxiliar' : 'Docente'}><select required disabled={!materia || !people.length} className="select-field" value={persona} onChange={e => selectPerson(e.target.value)}><option value="">{!materia ? 'Primero selecciona una materia' : `Selecciona ${rol === 'auxiliar' ? 'un auxiliar' : 'un docente'}`}</option>{people.map(p => <option key={p.id} value={p.id}>{p.nombre}{rol === 'docente' ? ` · Paralelo ${p.assignments.map(a => a.grupo).join(' / ')}` : ''}</option>)}</select></Field></div>
    {assignments.length > 1 && <Field label="Paralelo"><select required className="select-field" value={asignacion} onChange={e => setAsignacion(e.target.value)}><option value="">Selecciona un paralelo</option>{assignments.map(a => <option key={a.idAsignacion} value={a.idAsignacion}>{a.grupo} · {a.docente}</option>)}</select></Field>}
    {selectedAssignment && <p className="text-xs text-slate-500">Paralelo {selectedAssignment.grupo} · {selectedAssignment.docente}</p>}
    {materia === 'CPU' && rol === 'docente' && <p className="text-xs text-slate-600">El docente figura como coordinador del Curso Preuniversitario. Se comprueba la disponibilidad del aula; la coordinación no ocupa su agenda de clases.</p>}
    {materia && !people.length && <p className="text-sm text-amber-700">Esta materia no tiene {rol === 'auxiliar' ? 'auxiliares vinculados' : 'docentes asignados'} activos en este periodo. Registra la asignación en Docentes{rol === 'auxiliar' ? ' → Auxiliares' : ''}.</p>}
    {tipo === 'temporal' && <><Field label="Motivo de la reserva"><input required maxLength={200} className="input-field" placeholder="Examen parcial, recuperación…" value={motivo} onChange={e => setMotivo(e.target.value)} /></Field><p className="text-xs text-slate-500">Aparecerá como RESERVADO con su fecha de uso. Se ocultará automáticamente al finalizar ese día, según la hora de Bolivia.</p></>}
    <div className="grid items-start gap-4 md:grid-cols-2">{rows.map((row,index) => <fieldset key={index} className="min-w-0 space-y-3 rounded-lg border border-slate-200 p-4"><legend className="px-1 text-sm font-semibold text-slate-700">{tipo === 'temporal' ? 'Reserva' : 'Sesión'} {index+1}</legend>
      <Field label={`Aula · sesión ${index+1}`}><select required className="select-field" value={row.aula} onChange={e => update(index, { aula: e.target.value })}>{c.aulas.filter(a => a.estado === 'disponible' || a.codigo === row.aula).map(a => <option key={a.codigo} value={a.codigo}>{a.codigo} · {LUGARES[a.lugar ?? ''] ?? 'Sin lugar'} · {pisoLabel(a.piso)}</option>)}</select></Field>
      {tipo === 'temporal' ? <Field label={`Fecha · sesión ${index+1}`}><input required type="date" min={period?.fechaInicio} max={period?.fechaFin} className="input-field" value={row.fecha} onChange={e => update(index, { fecha: e.target.value })} /></Field> : <Field label={`Día · sesión ${index+1}`}><select className="select-field" value={row.dia} onChange={e => update(index, { dia: e.target.value as DiaSemana })}>{DAYS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}</select></Field>}
      <div className="grid grid-cols-2 gap-3"><Field label={`Inicio · sesión ${index+1}`}><input required type="time" min="07:00" max="21:59" step={60} className="input-field" value={row.horaInicio} onChange={e => update(index, { horaInicio: e.target.value, horaFin: defaultEnd(e.target.value) })} /></Field><Field label={`Fin · sesión ${index+1}`}><input required type="time" min="07:01" max="22:00" step={60} className="input-field" value={row.horaFin} onChange={e => update(index, { horaFin: e.target.value })} /></Field></div>
      {rows.length > 1 && <button type="button" className="text-xs text-red-600 underline" disabled={busy} onClick={() => setRows(rows.filter((_,i) => i !== index))}>Quitar este día</button>}
    </fieldset>)}</div>
    {!h && <button type="button" className="btn-secondary" disabled={busy || rows.length >= 24} onClick={addDay}>+ Añadir otro día</button>}
    <p className="text-xs text-slate-500">Cada día puede tener un aula y horas diferentes. Se guardan juntos, únicamente si todos están disponibles.{h ? ' Estás editando solo esta sesión.' : ''}</p>
    {h && <button type="button" className="btn-ghost text-red-600" disabled={busy} onClick={() => remove(h)}>Eliminar sesión</button>}
    <SaveActions busy={busy} close={close} />
  </form></Modal>;
}
