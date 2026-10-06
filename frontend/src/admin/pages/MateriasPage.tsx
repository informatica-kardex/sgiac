import { FormEvent, useState } from 'react';
import { academicoApi, Materia } from '../../api/academico.api';
import { AcademicHeader, Empty, ErrorNotice, Field, SaveActions, errorAcademico, useAcademico } from '../components/AcademicoUI';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Modal } from '../components/Modal';
import { filterSubjects, subjectPosition } from '../schedule/subjects';
export default function MateriasPage() {
  const c = useAcademico();
  const [mencion, setMencion] = useState('');
  const [query, setQuery] = useState(''), [open, setOpen] = useState(false), [editing, setEditing] = useState<string>();
  const [form, setForm] = useState<Materia>({ codigo: '', nombre: '', siglas: [], estado: 'ACTIVO' }), [aliases, setAliases] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  function edit(m?: Materia) { setEditing(m?.codigo); setForm(m ?? { codigo: '', nombre: '', siglas: [], estado: 'ACTIVO' }); setAliases(m?.siglas.filter(s => s !== (m.siglaPrincipal ?? m.codigo)).join(', ') ?? ''); setError(''); setOpen(true); }
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { await academicoApi.guardarMateria({ ...form, siglas: aliases.split(/[,;\n]+/).map(s => s.trim().toUpperCase()).filter(Boolean) }, editing); setOpen(false); await c.cargar(); }
    catch (e) { setError(errorAcademico(e)); } finally { setBusy(false); }
  }
  const filtered = filterSubjects(c.materias, mencion, query);
  return <div className="space-y-6"><AcademicHeader title="Materias" description="Un catálogo compartido para todas las asignaciones. Una materia puede tener varias siglas equivalentes."><button className="btn-primary" onClick={() => edit()}>+ Nueva materia</button></AcademicHeader>
    <ErrorNotice message={c.error} retry={() => void c.cargar()} /><section className="card space-y-3 p-4"><div className="grid items-end gap-3 md:grid-cols-2"><Field label="Buscar materias"><input className="input-field" placeholder="Nombre o sigla…" value={query} onChange={e => setQuery(e.target.value)} /></Field><Field label="Mención"><select className="select-field" value={mencion} onChange={e => setMencion(e.target.value)}><option value="">General · Todas las menciones</option>{c.menciones.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select></Field></div><div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500"><p>{mencion ? 'Materias comunes y específicas de esta mención, en el orden de su plan.' : 'Orden por semestre promedio entre las menciones. Las electivas sin semestre fijo aparecen al final.'}</p><span>{filtered.length} materias</span></div></section>
    {c.loading ? <LoadingSpinner /> : !filtered.length ? <Empty>No hay materias para mostrar.</Empty> : <div className="card overflow-x-auto"><table className="academic-table"><thead><tr><th>{mencion ? 'SEMESTRE' : 'SEMESTRE PROMEDIO'}</th><th>MATERIA</th><th>SIGLAS</th><th>DOCENTES ASIGNADOS</th><th>ESTADO</th><th></th></tr></thead><tbody>{filtered.map(m => {
      const names = [...new Set(c.asignaciones.filter(a => a.codigoMateria === m.codigo).map(a => a.docente))];
      const position = subjectPosition(m, mencion);
      return <tr key={m.codigo}><td className="text-slate-600">{position.semestre !== null ? position.semestre.toLocaleString('es', { maximumFractionDigits: 2 }) : position.asignada ? 'Electiva' : 'Sin plan asociado'}</td><td className="font-semibold text-slate-800">{m.nombre}</td><td>{m.siglas.map(s => <span className="academic-tag" key={s}>{s}</span>)}</td><td className="text-slate-500">{names.length ? names.map(n => <p key={n}>{n}</p>) : 'Sin asignaciones'}</td><td><span className={`badge ${m.estado === 'ACTIVO' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{m.estado === 'ACTIVO' ? 'Activa' : 'Inactiva'}</span></td><td><button className="btn-ghost" onClick={() => edit(m)}>Editar</button></td></tr>;
    })}</tbody></table></div>}
    <Modal open={open} title={editing ? 'Editar materia' : 'Nueva materia'} onClose={() => !busy && setOpen(false)}><form className="space-y-4" onSubmit={save}><ErrorNotice message={error} />
      <Field label="Nombre de la materia"><input autoFocus required minLength={3} maxLength={150} className="input-field" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} /></Field>
      <Field label="Sigla principal"><input disabled={Boolean(editing)} required maxLength={30} pattern="[A-Z0-9][A-Z0-9._-]*" placeholder="INF-111" className="input-field" value={form.siglaPrincipal ?? form.codigo} onChange={e => setForm({ ...form, codigo: editing ?? e.target.value.toUpperCase(), siglaPrincipal: e.target.value.toUpperCase() })} /></Field>
      <Field label="Otras siglas (separadas por comas)"><input className="input-field" placeholder="DAT-318, otra sigla equivalente" value={aliases} onChange={e => setAliases(e.target.value.toUpperCase())} /></Field>
      <p className="text-xs text-slate-500">Una materia puede tener varias siglas. También se conservan materias distintas que comparten sigla en el PDF; revisa siempre el nombre.</p>
      <Field label="Estado"><select className="select-field" value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })}><option value="ACTIVO">Activa</option><option value="INACTIVO">Inactiva</option></select></Field>
      <SaveActions busy={busy} close={() => setOpen(false)} /></form></Modal>
  </div>;
}
