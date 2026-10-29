import { FormEvent, useState } from 'react';
import { academicoApi, Auxiliar } from '../../api/academico.api';
import { AcademicAction, AcademicHeader, Empty, ErrorNotice, errorAcademico, Field, useAcademico } from './AcademicoUI';
import { AdminIcon } from './AdminIcon';
import { Modal } from './Modal';
import { ConfirmDialog } from './ConfirmDialog';
import { LoadingSpinner } from './LoadingSpinner';
import { AsignacionAuxiliarFields, HabilitarAuxiliarModal } from './HabilitarAuxiliarModal';

export function AuxiliaresPanel({ catalogo: c }: { catalogo: ReturnType<typeof useAcademico> }) {
  const [query, setQuery] = useState(''), [subjectFilter, setSubjectFilter] = useState('');
  const [open, setOpen] = useState(false), [legacy, setLegacy] = useState<Auxiliar | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('');
  const [selected, setSelected] = useState<{ id: string; edit: boolean } | null>(null), [assignment, setAssignment] = useState('');
  const [remove, setRemove] = useState<{ id?: string; asignacion?: string; nombre?: string } | null>(null);
  const activos = c.auxiliares.filter(a => a.estado === 'ACTIVO');
  const auxiliar = activos.find(a => a.idAuxiliar === selected?.id);
  function abrir(a: Auxiliar, edit: boolean) { setSelected({ id: a.idAuxiliar, edit }); setAssignment(''); setError(''); setSuccess(''); }
  const normal = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const filtered = activos.filter(a => (!subjectFilter || (subjectFilter === '__unlinked__' ? !a.asignaciones.length : a.asignaciones.some(v => v.codigoMateria === subjectFilter))) &&
    normal([a.nombreCompleto, a.correo, a.ru, ...a.asignaciones.map(v => v.siglas.join(' ') + ' ' + v.materia + ' ' + v.docente)].join(' ')).includes(normal(query.trim())));
  async function vincular(e: FormEvent) {
    e.preventDefault(); if (!auxiliar || busy || !assignment) return; setBusy(true); setError(''); setSuccess('');
    try { await academicoApi.vincularAuxiliar(auxiliar.idAuxiliar, assignment); setAssignment(''); setSuccess('Materia vinculada correctamente.'); await c.cargar(); }
    catch (e) { setError(errorAcademico(e)); } finally { setBusy(false); }
  }
  async function quitar() {
    if (!remove || busy) return; setBusy(true); setError(''); setSuccess('');
    try {
      if (remove.asignacion && remove.id) await academicoApi.desvincularAuxiliar(remove.id, remove.asignacion);
      else await academicoApi.quitarAuxiliar(remove.id);
      setSuccess(remove.asignacion ? 'Vinculación retirada.' : 'Habilitación retirada. Las cuentas de estudiantes se conservan.');
      if (!remove.asignacion) setSelected(null);
      setRemove(null); await c.cargar();
    } catch (e) { setRemove(null); setError(errorAcademico(e)); } finally { setBusy(false); }
  }
  return <div className="space-y-5">
    <AcademicHeader title="Auxiliares" description="Habilita estudiantes con cuenta institucional y vincúlalos a una materia y su docente titular.">
      <AcademicAction icon="trash" tone="danger" disabled={busy || c.loading || Boolean(c.error) || !activos.length} onClick={() => { setError(''); setRemove({}); }}>Quitar todos</AcademicAction>
      <AcademicAction icon="plus" tone="primary" disabled={busy} onClick={() => { setLegacy(null); setOpen(true); }}>Nuevo auxiliar</AcademicAction>
    </AcademicHeader>
    <ErrorNotice message={c.error} retry={() => void c.cargar()} />{!auxiliar && <ErrorNotice message={error} />}
    {success && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}
    <div className="grid gap-3 sm:grid-cols-3">
      <button className="academic-stat" aria-pressed={!subjectFilter && !query} onClick={() => { setSubjectFilter(''); setQuery(''); }}><AdminIcon name="auxiliares" size={26} /><div><strong>{activos.length}</strong><span>Auxiliares habilitados</span></div></button>
      <button className="academic-stat" aria-pressed={subjectFilter === '__unlinked__'} onClick={() => { setSubjectFilter('__unlinked__'); setQuery(''); }}><AdminIcon name="book" size={26} /><div><strong>{activos.filter(a => !a.asignaciones.length).length}</strong><span>Sin materia vinculada</span></div></button>
      <div className="academic-stat"><AdminIcon name="check" size={26} /><div><strong>{activos.filter(a => a.cuentaActiva).length}</strong><span>Con cuenta institucional activa</span></div></div>
    </div>
    <div className="academic-surface grid items-end gap-3 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
      <Field label="Buscar auxiliares"><input type="search" className="input-field" placeholder="Nombre, RU, correo, materia o docente…" value={query} onChange={e => setQuery(e.target.value)} /></Field>
      <Field label="Filtrar por materia"><select className="select-field" value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}>
        <option value="">Todas las materias</option><option value="__unlinked__">Sin materia vinculada</option>
        {c.materias.filter(m => activos.some(a => a.asignaciones.some(v => v.codigoMateria === m.codigo))).map(m => <option key={m.codigo} value={m.codigo}>{m.siglas.join(' / ')} · {m.nombre}</option>)}
      </select></Field>
      <AcademicAction icon="refresh" onClick={() => { setQuery(''); setSubjectFilter(''); }}>Limpiar filtros</AcademicAction>
    </div>
    <p className="text-xs text-slate-500">{filtered.length} de {activos.length} auxiliares habilitados</p>
    {c.loading ? <LoadingSpinner /> : !filtered.length ? <Empty>{query || subjectFilter ? 'No hay auxiliares que coincidan con estos filtros.' : 'No hay auxiliares habilitados. Selecciona Nuevo auxiliar para buscar un estudiante.'}</Empty> :
      <div className="grid gap-4 xl:grid-cols-2">{filtered.map(a => <article key={a.idAuxiliar} className="academic-surface flex min-w-0 flex-col overflow-hidden">
        <div className="flex items-start gap-3 p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 font-bold text-emerald-800" aria-hidden="true">{a.nombreCompleto.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('')}</span>
          <div className="min-w-0"><h2 className="font-bold">{a.nombreCompleto}</h2><p className="break-all text-xs text-slate-500">{a.correo || 'Sin correo institucional'}</p><p className="mt-1 text-xs text-slate-500">RU: {a.ru || 'Sin vincular'}</p></div>
        </div>
        <div className="flex-1 space-y-3 px-5 pb-5">
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${a.cuentaActiva ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{!a.idEstudiante ? 'Vincula una cuenta de estudiante' : a.cuentaActiva ? 'Cuenta institucional activa' : 'Cuenta no disponible'}</span>
          <div className="space-y-2 rounded-lg bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-500">{a.asignaciones.length} {a.asignaciones.length === 1 ? 'materia vinculada' : 'materias vinculadas'}</p>
            {!a.asignaciones.length ? <p className="text-sm text-slate-600">Añade una materia y su docente desde Editar materias.</p> : a.asignaciones.slice(0, 2).map(v => <div key={v.idAsignacion}><p className="text-sm font-semibold">{v.siglas.join(' / ')} · {v.materia}</p><p className="text-xs text-slate-500">{v.docente} · Paralelo {v.grupo} · {v.periodo}</p></div>)}
            {a.asignaciones.length > 2 && <p className="text-xs text-slate-500">+ {a.asignaciones.length - 2} más en Ver detalle</p>}
          </div>
          {!a.idEstudiante && <AcademicAction icon="estudiantes" tone="primary" disabled={busy} onClick={() => { setLegacy(a); setOpen(true); }}>Vincular estudiante</AcademicAction>}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/60 p-4">
          <AcademicAction icon="view" disabled={busy} onClick={() => abrir(a, false)}>Ver detalle</AcademicAction>
          <AcademicAction icon="edit" tone="primary" disabled={busy} onClick={() => abrir(a, true)}>Editar materias</AcademicAction>
          <AcademicAction icon="trash" tone="danger" disabled={busy} onClick={() => { setError(''); setRemove({ id: a.idAuxiliar, nombre: a.nombreCompleto }); }}>Quitar auxiliar</AcademicAction>
        </div>
      </article>)}</div>}
    {open && <HabilitarAuxiliarModal idAuxiliarAnterior={legacy?.idAuxiliar} onClose={() => setOpen(false)} onSaved={async () => { setSuccess('Estudiante habilitado como auxiliar y vinculado a su docente y materia.'); await c.cargar(); }} />}
    {auxiliar && <Modal title={selected?.edit ? 'Editar materias del auxiliar' : 'Detalle del auxiliar'} open onClose={() => !busy && setSelected(null)} size="wide"><div className="space-y-5">
      <div className="rounded-lg bg-emerald-50 p-4"><h2 className="font-bold">{auxiliar.nombreCompleto}</h2><p className="break-all text-sm text-slate-600">{auxiliar.correo || 'Sin correo institucional'}</p><p className="mt-1 text-sm text-slate-600">RU: {auxiliar.ru || 'Sin vincular'} · Celular: {auxiliar.telefono || 'Sin registrar'}</p></div>
      <ErrorNotice message={error || c.error} />{success && <p role="status" className="text-sm text-emerald-800">{success}</p>}
      <section className="space-y-3"><h3 className="font-semibold">Materias y docentes vinculados</h3>
        {!auxiliar.asignaciones.length && <p className="text-sm text-slate-500">Todavía no tiene materias vinculadas.</p>}
        {auxiliar.asignaciones.map(v => <div key={v.idAsignacion} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"><div><p className="text-sm font-semibold">{v.siglas.join(' / ')} · {v.materia}</p><p className="text-xs text-slate-500">{v.docente}</p><span className="academic-tag">Paralelo {v.grupo} · {v.periodo}</span></div>
          {selected?.edit && <AcademicAction icon="trash" tone="danger" disabled={busy || c.loading} onClick={() => { setError(''); setRemove({ id: auxiliar.idAuxiliar, asignacion: v.idAsignacion, nombre: auxiliar.nombreCompleto }); }}>Desvincular materia</AcademicAction>}
        </div>)}
      </section>
      {selected?.edit ? <form className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50/40 p-4" onSubmit={vincular}>
        <h3 className="font-semibold">Añadir una materia</h3>
        {!auxiliar.cuentaActiva && <p className="text-sm text-amber-800">Para añadir materias, el auxiliar necesita una cuenta institucional activa y vinculada.</p>}
        <AsignacionAuxiliarFields catalogo={c} value={assignment} onChange={setAssignment} exclude={auxiliar.asignaciones} busy={busy || !auxiliar.cuentaActiva} />
        <AcademicAction icon="plus" tone="primary" type="submit" disabled={busy || c.loading || Boolean(c.error) || !assignment || !auxiliar.cuentaActiva}>{busy ? 'Guardando…' : 'Vincular materia'}</AcademicAction>
      </form> : <AcademicAction icon="edit" tone="primary" onClick={() => setSelected({ id: auxiliar.idAuxiliar, edit: true })}>Editar materias</AcademicAction>}
      <div className="flex justify-end border-t border-slate-100 pt-4"><AcademicAction icon="close" disabled={busy} onClick={() => setSelected(null)}>Cerrar detalle</AcademicAction></div>
    </div></Modal>}
    <ConfirmDialog open={Boolean(remove)} title={remove?.asignacion ? 'Desvincular materia' : remove?.id ? 'Quitar auxiliar' : 'Quitar todos los auxiliares'}
      message={remove?.asignacion ? 'Se quitará esta vinculación. Primero deben retirarse sus horarios vigentes.' :
        (remove?.id ? 'Se quitará la habilitación de ' + remove.nombre + '.' : 'Se quitará la habilitación de los ' + activos.length + ' auxiliares, incluidos los que no aparecen en el filtro.') +
        ' Sus cuentas de estudiante se conservarán y podrás habilitarlos nuevamente. Primero deben retirarse sus horarios vigentes.'}
      confirmLabel={remove?.id ? 'Quitar' : 'Quitar todos'} onCancel={() => setRemove(null)} onConfirm={quitar} loading={busy} />
  </div>;
}
