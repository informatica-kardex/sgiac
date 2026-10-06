import { FormEvent, useState } from 'react';
import { academicoApi, Auxiliar, AuxiliarInput } from '../../api/academico.api';
import { AcademicHeader, Empty, ErrorNotice, Field, SaveActions, errorAcademico, useAcademico } from './AcademicoUI';
import { Modal } from './Modal';
import { ConfirmDialog } from './ConfirmDialog';
import { LoadingSpinner } from './LoadingSpinner';
import { filterSubjects } from '../schedule/subjects';
const blank: AuxiliarInput = { nombreCompleto: '', correo: '', telefono: '', estado: 'ACTIVO' };
export function AuxiliaresPanel({ catalogo: c }: { catalogo: ReturnType<typeof useAcademico> }) {
  const [query, setQuery] = useState(''), [open, setOpen] = useState(false), [editing, setEditing] = useState<Auxiliar | null>(null);
  const [form, setForm] = useState(blank), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [link, setLink] = useState<Auxiliar | null>(null), [assignment, setAssignment] = useState('');
  const [materia, setMateria] = useState(''), [subjectFilter, setSubjectFilter] = useState('');
  const [subjectQuery, setSubjectQuery] = useState('');
  const [remove, setRemove] = useState<{ id: string; asignacion: string } | null>(null);
  function edit(a?: Auxiliar) { setEditing(a ?? null); setForm(a ?? blank); setError(''); setOpen(true); }
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { await academicoApi.guardarAuxiliar(form, editing?.idAuxiliar); setOpen(false); await c.cargar(); }
    catch (e) { setError(errorAcademico(e)); } finally { setBusy(false); }
  }
  async function vincular(e: FormEvent) {
    e.preventDefault(); if (!link) return;
    if (!subjectAssignments.some(a => a.idAsignacion === assignment)) { setError('Selecciona una materia y una asignación vigente de su docente.'); return; }
    setBusy(true); setError('');
    try { await academicoApi.vincularAuxiliar(link.idAuxiliar, assignment); setLink(null); await c.cargar(); }
    catch (e) { setError(errorAcademico(e)); } finally { setBusy(false); }
  }
  async function desvincular() {
    if (!remove) return; setBusy(true); setError('');
    try { await academicoApi.desvincularAuxiliar(remove.id, remove.asignacion); setRemove(null); await c.cargar(); }
    catch (e) { setRemove(null); setError(errorAcademico(e)); } finally { setBusy(false); }
  }
  const subjects = filterSubjects(c.materias.filter(m => m.estado === 'ACTIVO'), '', '');
  const matchingSubjects = filterSubjects(subjects, '', subjectQuery);
  const selectedSubject = subjects.find(m => m.codigo === materia);
  const availableAssignments = c.asignaciones.filter(a => a.estado === 'ACTIVO' &&
    c.periodos.some(p => p.idPeriodo === a.idPeriodo && p.estado === 'ACTIVO') &&
    c.docentes.some(d => d.idDocente === a.idDocente && d.estado === 'ACTIVO') &&
    subjects.some(m => m.codigo === a.codigoMateria) && !link?.asignaciones.some(v => v.idAsignacion === a.idAsignacion));
  const subjectAssignments = availableAssignments.filter(a => a.codigoMateria === materia)
    .sort((a, b) => a.docente.localeCompare(b.docente, 'es') || a.grupo.localeCompare(b.grupo, 'es', { numeric: true }));
  const filterOptions = filterSubjects(c.materias.filter(m => c.auxiliares.some(a => a.asignaciones.some(v => v.codigoMateria === m.codigo))), '', '');
  const normal = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const filtered = c.auxiliares.filter(a => (!subjectFilter || (subjectFilter === '__unlinked__' ? !a.asignaciones.length : a.asignaciones.some(v => v.codigoMateria === subjectFilter))) &&
    normal(`${a.nombreCompleto} ${a.correo} ${a.asignaciones.map(v => `${v.siglas.join(' ')} ${v.materia} ${v.docente}`).join(' ')}`).includes(normal(query.trim())));
  return <div className="space-y-5"><AcademicHeader title="Auxiliares" description="Vincula cada auxiliar con la materia, el docente titular y su paralelo. Luego podrás programar sus clases o reservas en Horarios."><button className="btn-primary" onClick={() => edit()}>+ Nuevo auxiliar</button></AcademicHeader>
    <ErrorNotice message={c.error} retry={() => void c.cargar()} />{!open && !link && <ErrorNotice message={error} />}
    <div className="grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
      <Field label="Buscar auxiliares"><input className="input-field" placeholder="Nombre, materia, sigla o docente…" value={query} onChange={e => setQuery(e.target.value)} /></Field>
      <Field label="Filtrar por materia"><select className="select-field" value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}><option value="">Todas las materias</option><option value="__unlinked__">Sin materia vinculada</option>{filterOptions.map(m => <option key={m.codigo} value={m.codigo}>{m.siglas.join(' / ')} · {m.nombre}</option>)}</select></Field>
      <button className="btn-secondary" onClick={() => { setQuery(''); setSubjectFilter(''); }}>Limpiar filtros</button>
    </div>
    {!c.loading && <p className="text-xs text-slate-500">{filtered.length} de {c.auxiliares.length} auxiliares</p>}
    {c.loading ? <LoadingSpinner /> : !filtered.length ? <Empty>{query || subjectFilter ? 'No hay auxiliares que coincidan con estos filtros.' : 'No hay auxiliares para mostrar. Registra uno y vincúlalo a una asignación docente.'}</Empty> : <div className="card overflow-x-auto"><table className="academic-table"><thead><tr><th>AUXILIAR</th><th>MATERIA Y DOCENTE TITULAR</th><th>ESTADO</th><th>ACCIONES</th></tr></thead><tbody>{filtered.map(a => <tr key={a.idAuxiliar}>
      <td><p className="font-semibold">{a.nombreCompleto}</p><p className="text-xs text-slate-500">{a.correo || 'Sin correo'}</p><p className="text-xs text-slate-500">{a.telefono || 'Sin teléfono'}</p></td>
      <td>{!a.asignaciones.length ? 'Sin vinculaciones' : a.asignaciones.map(v => <div key={v.idAsignacion} className="mb-3"><span className="academic-tag">{v.siglas.join(" / ")} · {v.grupo} · {v.periodo}</span><p>{v.materia}</p><p className="text-xs text-slate-500">{v.docente}</p><button className="text-xs text-red-600 underline" onClick={() => { setError(''); setRemove({ id: a.idAuxiliar, asignacion: v.idAsignacion }); }}>Desvincular</button></div>)}</td>
      <td>{a.estado === 'ACTIVO' ? 'Activo' : 'Inactivo'}</td><td><button className="btn-ghost" onClick={() => edit(a)}>Editar</button><button className="btn-ghost" disabled={a.estado !== 'ACTIVO'} onClick={() => { setError(''); setSubjectQuery(''); setMateria(''); setAssignment(''); setLink(a); }}>Vincular materia</button></td>
    </tr>)}</tbody></table></div>}
    <Modal title={editing ? 'Editar auxiliar' : 'Nuevo auxiliar'} open={open} onClose={() => !busy && setOpen(false)}><form className="space-y-4" onSubmit={save}><ErrorNotice message={error} />
      <Field label="Nombre completo"><input autoFocus required minLength={3} maxLength={150} className="input-field" value={form.nombreCompleto} onChange={e => setForm({ ...form, nombreCompleto: e.target.value })} /></Field>
      <Field label="Correo"><input type="email" maxLength={150} className="input-field" value={form.correo} onChange={e => setForm({ ...form, correo: e.target.value })} /></Field>
      <Field label="Teléfono"><input type="tel" maxLength={30} className="input-field" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} /></Field>
      <Field label="Estado"><select className="select-field" value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })}><option value="ACTIVO">Activo</option><option value="INACTIVO">Inactivo</option></select></Field>
      <SaveActions busy={busy} close={() => setOpen(false)} /></form></Modal>
    <Modal title="Vincular materia" open={Boolean(link)} onClose={() => !busy && setLink(null)}><form className="space-y-4" onSubmit={vincular}><p>{link?.nombreCompleto}</p><ErrorNotice message={error} />
      <Field label="Buscar materia"><input autoFocus type="search" className="input-field" placeholder="Escribe el nombre o la sigla…" value={subjectQuery} disabled={busy} onChange={e => setSubjectQuery(e.target.value)} /></Field>
      <Field label="Materia"><select required className="select-field" value={materia} disabled={busy} onChange={e => { setMateria(e.target.value); setAssignment(''); setError(''); }}><option value="">Selecciona una materia</option>
        {selectedSubject && !matchingSubjects.some(m => m.codigo === materia) && <option value={materia}>{selectedSubject.siglas.join(' / ')} · {selectedSubject.nombre} (seleccionada)</option>}
        {matchingSubjects.map(m => <option key={m.codigo} value={m.codigo}>{m.siglas.join(' / ')} · {m.nombre}</option>)}</select></Field>
      <p role="status" className="text-xs text-slate-500">{matchingSubjects.length ? `${matchingSubjects.length} materias encontradas` : 'No se encontraron materias. Prueba otro nombre o sigla.'}</p>
      <Field label="Docente, paralelo y periodo"><select required className="select-field" value={assignment} disabled={busy || !materia || !subjectAssignments.length} onChange={e => setAssignment(e.target.value)}><option value="">{materia ? 'Selecciona una asignación docente' : 'Primero selecciona una materia'}</option>{subjectAssignments.map(a => <option key={a.idAsignacion} value={a.idAsignacion}>{a.docente} · Paralelo {a.grupo} · {a.periodo}</option>)}</select></Field>
      {materia && !subjectAssignments.length && <p role="status" className="text-sm text-amber-700">No hay asignaciones disponibles para esta materia. Comprueba que tenga docente y periodo activos y que no esté ya vinculada a este auxiliar.</p>}
      <p className="text-xs text-slate-500">El auxiliar comparte la materia y el paralelo del docente titular; sus horarios se programan por separado.</p><SaveActions busy={busy} disabled={!subjectAssignments.some(a => a.idAsignacion === assignment)} close={() => setLink(null)} /></form></Modal>
    <ConfirmDialog open={Boolean(remove)} title="Desvincular auxiliar" message="¿Quitar esta vinculación? Primero deben retirarse sus horarios." onCancel={() => setRemove(null)} onConfirm={desvincular} loading={busy} />
  </div>;
}
