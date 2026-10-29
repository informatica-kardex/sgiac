import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { academicoApi, Asignacion, EstudianteAuxiliar } from '../../api/academico.api';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { errorAcademico, ErrorNotice, Field, useAcademico } from './AcademicoUI';
import { LoadingSpinner } from './LoadingSpinner';
import { Modal } from './Modal';
import { SearchableSelect } from './SearchableSelect';

export function AsignacionAuxiliarFields({ catalogo: c, value, onChange, exclude = [], busy = false }: {
  catalogo: ReturnType<typeof useAcademico>; value: string; onChange: (id: string) => void; exclude?: Asignacion[]; busy?: boolean;
}) {
  const [materia, setMateria] = useState('');
  const disponibles = c.asignaciones.filter(a => a.estado === 'ACTIVO' &&
    c.periodos.some(p => p.idPeriodo === a.idPeriodo && p.estado === 'ACTIVO') &&
    c.docentes.some(d => d.idDocente === a.idDocente && d.estado === 'ACTIVO') &&
    c.materias.some(m => m.codigo === a.codigoMateria && m.estado === 'ACTIVO') &&
    !exclude.some(v => v.idAsignacion === a.idAsignacion));
  const asignaciones = disponibles.filter(a => a.codigoMateria === materia)
    .sort((a, b) => a.docente.localeCompare(b.docente, 'es') || a.grupo.localeCompare(b.grupo, 'es', { numeric: true }));
  return <fieldset className="space-y-4" disabled={busy || c.loading}>
    <SearchableSelect label="Materia" placeholder="Busca por nombre o sigla" value={materia}
      options={c.materias.filter(m => disponibles.some(a => a.codigoMateria === m.codigo)).map(m => ({ value: m.codigo, label: `${m.siglas.join(' / ')} · ${m.nombre}` }))}
      onChange={codigo => { setMateria(codigo); onChange(''); }} />
    <Field label="Docente, paralelo y periodo"><select required className="select-field" value={value} disabled={!materia || busy} onChange={e => onChange(e.target.value)}>
      <option value="">{materia ? 'Selecciona una asignación docente' : 'Primero selecciona una materia'}</option>
      {asignaciones.map(a => <option key={a.idAsignacion} value={a.idAsignacion}>{a.docente} · Paralelo {a.grupo} · {a.periodo}</option>)}
    </select></Field>
    {!c.loading && !disponibles.length && <p className="text-sm text-amber-700">No hay asignaciones disponibles. Primero asigna una materia a un docente en un periodo activo desde Docentes.</p>}
  </fieldset>;
}

export function HabilitarAuxiliarModal({ idEstudiante, idAuxiliarAnterior, onClose, onSaved }: {
  idEstudiante?: string; idAuxiliarAnterior?: string; onClose: () => void; onSaved: () => void | Promise<void>;
}) {
  const c = useAcademico();
  const { usuario } = useAdminAuth();
  const [estudiantes, setEstudiantes] = useState<EstudianteAuxiliar[]>([]);
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState(''), [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState(''), [selected, setSelected] = useState(idEstudiante ?? '');
  const [assignment, setAssignment] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true); setLoadError('');
    academicoApi.estudiantesAuxiliares().then(data => { if (active) setEstudiantes(data); })
      .catch(e => { if (active) setLoadError(errorAcademico(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  const student = estudiantes.find(e => e.idEstudiante === selected);
  const normal = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const filtered = estudiantes.filter(e => normal(`${e.nombreCompleto} ${e.correo} ${e.ru} ${e.ci}`).includes(normal(query.trim())));
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!student || student.idAuxiliar || student.motivoNoDisponible || !assignment || busy) return;
    setBusy(true); setError('');
    try {
      await academicoApi.guardarAuxiliar({ idEstudiante: student.idEstudiante, idAsignacion: assignment }, idAuxiliarAnterior);
      await onSaved(); onClose();
    } catch (e) { setError(errorAcademico(e)); } finally { setBusy(false); }
  }
  return <Modal title={idAuxiliarAnterior ? 'Vincular auxiliar con estudiante' : 'Habilitar estudiante como auxiliar'} open onClose={() => !busy && onClose()} size="wide">
    <form onSubmit={save} className="space-y-5">
      <p className="text-sm text-slate-500">Selecciona una cuenta de estudiante y su asignación docente. El estudiante conservará su cuenta institucional.</p>
      <ErrorNotice message={error} /><ErrorNotice message={loadError} retry={() => setAttempt(a => a + 1)} /><ErrorNotice message={c.error} retry={() => void c.cargar()} />
      <Field label="Buscar estudiante"><input autoFocus type="search" className="input-field" placeholder="Nombre, CI, RU o correo institucional" value={query} disabled={busy} onChange={e => setQuery(e.target.value)} /></Field>
      {loading ? <LoadingSpinner /> : <>
        <p className="text-xs text-slate-500" role="status">{filtered.length} de {estudiantes.length} estudiantes</p>
        <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
          {filtered.map(e => <label key={e.idEstudiante} className={`flex cursor-pointer items-start gap-3 border-b border-slate-100 p-3 last:border-0 ${selected === e.idEstudiante ? 'bg-emerald-50' : ''}`}>
            <input type="radio" name="estudianteAuxiliar" className="mt-1" checked={selected === e.idEstudiante} disabled={busy || Boolean(e.idAuxiliar || e.motivoNoDisponible)} onChange={() => setSelected(e.idEstudiante)} />
            <span className="min-w-0 text-sm"><span className="block font-semibold">{e.nombreCompleto}</span><span className="block break-words text-xs text-slate-500">RU: {e.ru} · CI: {e.ci} · {e.correo}</span>
              {(e.idAuxiliar || e.motivoNoDisponible) && <span className="block text-xs text-amber-700">{e.idAuxiliar ? 'Ya está habilitado como auxiliar' : e.motivoNoDisponible}</span>}
            </span>
          </label>)}
          {!filtered.length && <p className="p-5 text-sm text-slate-500">No se encontraron estudiantes.</p>}
        </div>
      </>}
      {student && <p className="rounded-lg bg-slate-50 p-3 text-sm">Estudiante seleccionado: <strong>{student.nombreCompleto}</strong> · {student.correo}</p>}
      {usuario?.roles.includes('ADMINISTRADOR') && <p className="text-sm text-slate-500">Si aún no tiene cuenta, puedes <Link className="text-emerald-700 underline" to="/admin/estudiantes?crear=1">crear una cuenta de estudiante</Link> y luego habilitarlo.</p>}
      <AsignacionAuxiliarFields catalogo={c} value={assignment} onChange={setAssignment} busy={busy} />
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" className="btn-secondary" disabled={busy} onClick={onClose}>Cancelar</button>
        <button className="btn-primary" disabled={busy || loading || c.loading || Boolean(c.error || loadError) || !student || Boolean(student.idAuxiliar || student.motivoNoDisponible) || !assignment}>{busy ? 'Habilitando…' : 'Habilitar como auxiliar'}</button>
      </div>
    </form>
  </Modal>;
}
