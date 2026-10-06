import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { academicoApi, Asignacion, Docente, DocenteInput, GRADOS_DOCENTES, docenteLabel } from '../../api/academico.api';
import { AcademicHeader, Empty, ErrorNotice, Field, SaveActions, errorAcademico, useAcademico } from '../components/AcademicoUI';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AuxiliaresPanel } from '../components/AuxiliaresPanel';
import { SearchableSelect } from '../components/SearchableSelect';
import { filterSubjects } from '../schedule/subjects';
const blank: DocenteInput = { nombreCompleto: '', gradoAcademico: '', especialidad: '', correo: '', telefono: '', estado: 'ACTIVO' };
export default function DocentesPage() {
  const c = useAcademico();
  const [tab, setTab] = useState<'docentes' | 'auxiliares'>('docentes');
  const [subjectFilter, setSubjectFilter] = useState(''), [teacherFilter, setTeacherFilter] = useState('');
  const [open, setOpen] = useState(false), [editing, setEditing] = useState<Docente | null>(null), [otherDegree, setOtherDegree] = useState(false);
  const [form, setForm] = useState(blank), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [assignTo, setAssignTo] = useState<Docente | null>(null), [remove, setRemove] = useState<Asignacion | null>(null);
  const [assignment, setAssignment] = useState({ codigoMateria: '', idPeriodo: '' });
  function edit(d?: Docente) { setEditing(d ?? null); setForm(d ? { ...d, gradoAcademico: d.gradoAcademico ?? '' } : blank); setOtherDegree(Boolean(d?.gradoAcademico && !GRADOS_DOCENTES.includes(d.gradoAcademico))); setError(''); setOpen(true); }
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { await academicoApi.guardarDocente(form, editing?.idDocente); setOpen(false); await c.cargar(); }
    catch (e) { setError(errorAcademico(e)); } finally { setBusy(false); }
  }
  async function assign(e: FormEvent) {
    e.preventDefault(); if (!assignTo) return; setBusy(true); setError('');
    try { await academicoApi.asignar({ ...assignment, idDocente: assignTo.idDocente }); setAssignTo(null); await c.cargar(); }
    catch (e) { setError(errorAcademico(e)); } finally { setBusy(false); }
  }
  async function unassign() {
    if (!remove) return; setBusy(true); setError('');
    try { await academicoApi.quitarAsignacion(remove.idAsignacion); setRemove(null); await c.cargar(); }
    catch (e) { setRemove(null); setError(errorAcademico(e)); } finally { setBusy(false); }
  }
  const subjects = filterSubjects(c.materias, '', '');
  const subjectTeachers = c.docentes.filter(d => !subjectFilter || (subjectFilter === '__unassigned__' ? !d.asignaciones.length : d.asignaciones.some(a => a.codigoMateria === subjectFilter)));
  const filtered = subjectTeachers.filter(d => !teacherFilter || d.idDocente === teacherFilter);
  const tabs = <div className="flex gap-2 border-b border-slate-200 pb-3"><button className={tab === 'docentes' ? 'btn-primary' : 'btn-secondary'} onClick={() => setTab('docentes')}>Docentes</button><button className={tab === 'auxiliares' ? 'btn-primary' : 'btn-secondary'} onClick={() => setTab('auxiliares')}>Auxiliares</button></div>;
  if (tab === 'auxiliares') return <div className="space-y-6">{tabs}<AuxiliaresPanel catalogo={c} /></div>;
  return <div className="space-y-6">
    {tabs}
    <AcademicHeader title="Docentes" description="Información y materias asignadas a cada docente, organizadas por periodo y paralelo."><button className="btn-primary" onClick={() => edit()}>+ Nuevo docente</button></AcademicHeader>
    <ErrorNotice message={c.error} retry={() => void c.cargar()} />{!open && !assignTo && <ErrorNotice message={error} />}
    <div className="grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
      <SearchableSelect label="Filtrar por materia" placeholder="Todas las materias" value={subjectFilter} options={[{ value: '__unassigned__', label: 'Sin materias asignadas' }, ...subjects.map(m => ({ value: m.codigo, label: `${m.siglas.join(' / ')} · ${m.nombre}` }))]} onChange={value => { setSubjectFilter(value); setTeacherFilter(''); }} />
      <SearchableSelect label="Filtrar por docente" placeholder="Todos los docentes" value={teacherFilter} options={subjectTeachers.map(d => ({ value: d.idDocente, label: docenteLabel(d), searchText: `${d.especialidad} ${d.correo}` }))} onChange={setTeacherFilter} />
      <button className="btn-secondary" onClick={() => { setSubjectFilter(''); setTeacherFilter(''); }}>Limpiar filtros</button>
    </div><p className="text-xs text-slate-500">Escribe en cada desplegable para buscar y elige una opción. {filtered.length} de {c.docentes.length} docentes.</p>
    {c.loading ? <LoadingSpinner /> : !filtered.length ? <Empty>{subjectFilter || teacherFilter ? 'No hay docentes que coincidan con estos filtros.' : 'No hay docentes para mostrar. Registra el primero para asignarle materias.'}</Empty> : <div className="card overflow-x-auto"><table className="academic-table"><thead><tr><th>DOCENTE</th><th>CONTACTO</th><th>MATERIAS Y PARALELOS</th><th>ESTADO</th><th>ACCIONES</th></tr></thead><tbody>{filtered.map(d => <tr key={d.idDocente}>
      <td><p className="font-semibold text-slate-800">{docenteLabel(d)}</p>{!d.gradoAcademico && <p className="mt-1 text-xs text-slate-400">Grado por confirmar</p>}<p className="mt-1 text-xs text-slate-500">{d.especialidad || 'Sin especialidad registrada'}</p></td>
      <td className="text-slate-500"><p>{d.correo || 'Sin correo'}</p><p className="mt-1">{d.telefono || 'Sin teléfono'}</p></td>
      <td className="min-w-[260px]">{!d.asignaciones.length ? <span className="text-slate-400">Sin materias asignadas</span> : d.asignaciones.map(a => <div key={a.idAsignacion} className="mb-2"><span className="academic-tag">{a.siglas.join(" / ")} · {a.grupo}</span><span className="text-xs text-slate-400">{a.periodo}</span><p className="text-xs text-slate-600">{a.materia} <button aria-label={`Quitar ${a.materia} (${a.siglas.join(' / ')}) paralelo ${a.grupo} de ${d.nombreCompleto}`} className="ml-1 text-red-600 underline" onClick={() => setRemove(a)}>Quitar</button></p></div>)}</td>
      <td><span className={`badge ${d.estado === 'ACTIVO' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{d.estado === 'ACTIVO' ? 'Activo' : 'Inactivo'}</span></td>
      <td><button className="btn-ghost" onClick={() => edit(d)}>Editar</button><button className="btn-ghost" disabled={d.estado !== 'ACTIVO'} onClick={() => { setError(''); setAssignment({ codigoMateria: '', idPeriodo: c.periodos.find(p => p.estado === 'ACTIVO')?.idPeriodo ?? '' }); setAssignTo(d); }}>Asignar materia</button></td>
    </tr>)}</tbody></table></div>}
    <Modal open={open} title={editing ? 'Editar docente' : 'Nuevo docente'} onClose={() => !busy && setOpen(false)}><form className="space-y-4" onSubmit={save}><ErrorNotice message={error} />
      <Field label="Nombre completo"><input autoFocus required minLength={3} maxLength={150} className="input-field" value={form.nombreCompleto} onChange={e => setForm({ ...form, nombreCompleto: e.target.value })} /></Field>
      <Field label="Grado académico"><select className="select-field" value={otherDegree ? '__other__' : form.gradoAcademico} onChange={e => { setOtherDegree(e.target.value === '__other__'); setForm({ ...form, gradoAcademico: e.target.value === '__other__' ? '' : e.target.value }); }}><option value="">Por confirmar</option>{GRADOS_DOCENTES.map(grado => <option key={grado} value={grado}>{grado}</option>)}<option value="__other__">Otro grado…</option></select></Field>
      {otherDegree && <Field label="Otro grado académico"><input required maxLength={30} className="input-field" placeholder="Abreviatura del grado" value={form.gradoAcademico} onChange={e => setForm({ ...form, gradoAcademico: e.target.value })} /></Field>}
      <Field label="Especialidad"><input maxLength={150} className="input-field" value={form.especialidad} onChange={e => setForm({ ...form, especialidad: e.target.value })} /></Field>
      <Field label="Correo"><input type="email" maxLength={150} className="input-field" value={form.correo} onChange={e => setForm({ ...form, correo: e.target.value })} /></Field>
      <Field label="Teléfono"><input type="tel" maxLength={30} className="input-field" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} /></Field>
      <Field label="Estado"><select className="select-field" value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })}><option value="ACTIVO">Activo</option><option value="INACTIVO">Inactivo</option></select></Field>
      <SaveActions busy={busy} close={() => setOpen(false)} /></form></Modal>
    <Modal open={Boolean(assignTo)} title="Asignar materia" onClose={() => !busy && setAssignTo(null)}><form className="space-y-4" onSubmit={assign}><p className="font-medium text-slate-700">{assignTo ? docenteLabel(assignTo) : ''}</p><ErrorNotice message={error} />
      <Field label="Periodo"><select required className="select-field" value={assignment.idPeriodo} onChange={e => setAssignment({ ...assignment, idPeriodo: e.target.value })}><option value="">Selecciona un periodo</option>{c.periodos.filter(p => p.estado === 'ACTIVO').map(p => <option key={p.idPeriodo} value={p.idPeriodo}>{p.periodo}/{p.gestion}</option>)}</select></Field>
      {!c.periodos.length && <p className="text-sm text-slate-500">Crea un periodo desde <Link className="underline" to="/admin/horarios">Horarios</Link>.</p>}
      <Field label="Materia"><select required className="select-field" value={assignment.codigoMateria} onChange={e => setAssignment({ ...assignment, codigoMateria: e.target.value })}><option value="">Selecciona una materia</option>{c.materias.filter(m => m.estado === 'ACTIVO').map(m => <option key={m.codigo} value={m.codigo}>{m.siglas.join(' / ')} · {m.nombre}</option>)}</select></Field>
      <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">El paralelo se asigna automáticamente: A, B, C… según las asignaciones de esta materia en el periodo.</p>
      <p className="text-xs text-slate-500">La materia aparecerá en la ficha del docente y estará disponible para programar sus clases.</p><SaveActions busy={busy} close={() => setAssignTo(null)} /></form></Modal>
    <ConfirmDialog open={Boolean(remove)} title="Quitar asignación" message={`¿Quitar ${remove?.materia}, paralelo ${remove?.grupo}? Solo es posible si no tiene horarios.`} onCancel={() => setRemove(null)} onConfirm={unassign} loading={busy} />
  </div>;
}

