import { FormEvent, useCallback, useState } from 'react';
import { AccionRevisionAula, ReservaAula, SolicitudAula, actividadAulaLabel, solicitudesAulasApi } from '../../api/solicitudes-aulas.api';
import { AgendaSolicitudAula, AulasDisponiblesSolicitud, DetalleSolicitudAula, EstadoSolicitudAula, ResumenReservaAula, fechaSolicitudAula } from '../../components/SolicitudAulaUI';
import { AcademicAction, AcademicHeader, Empty, ErrorNotice, Field, errorAcademico } from '../components/AcademicoUI';
import { AdminIcon } from '../components/AdminIcon';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { usePolling } from '../../hooks/usePolling';

function RevisarSolicitud({ solicitud: s, inicial, close, saved }: { solicitud: SolicitudAula; inicial: AccionRevisionAula | null; close: () => void; saved: () => void }) {
  const [accion, setAccion] = useState<AccionRevisionAula | null>(inicial);
  const [propuesta, setPropuesta] = useState<ReservaAula>(s.propuesta ?? s.reserva);
  const [comentario, setComentario] = useState(''), [valida, setValida] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  function elegir(a: AccionRevisionAula) { setAccion(a); setError(''); setComentario(''); }
  async function enviar(event: FormEvent) {
    event.preventDefault(); if (!accion || busy || accion === 'PROPONER' && !valida) return;
    setBusy(true); setError('');
    try { await solicitudesAulasApi.revisar(s, accion, comentario, accion === 'PROPONER' ? propuesta : undefined); saved(); close(); }
    catch (e) { setError(errorAcademico(e)); } finally { setBusy(false); }
  }
  const pendiente = ['PENDIENTE', 'PROPUESTA'].includes(s.estado);
  const labels = { APROBAR: 'Aceptar y reservar aula', PROPONER: 'Enviar alternativa al auxiliar', RECHAZAR: 'Confirmar rechazo', CANCELAR: 'Cancelar reserva y liberar aula' };
  return <Modal title={`Revisar ${s.codigo}`} open onClose={() => !busy && close()} size="wide"><div className="space-y-5">
    <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">{s.nombre}</h2><EstadoSolicitudAula estado={s.estado} /></div>
      <p className="text-sm">{s.asignacion.siglas.join(' / ')} · {s.asignacion.materia} · Paralelo {s.asignacion.grupo}</p>
      <p className="mt-1 text-sm text-slate-600">{actividadAulaLabel(s.actividad)} · {s.numeroEstudiantes} estudiantes · Celular: {s.celular}</p>
      <div className="mt-3 border-t border-emerald-100 pt-3"><ResumenReservaAula reserva={s.estado === 'APROBADA' ? s.propuesta ?? s.reserva : s.reserva} /></div>
    </div>
    {(pendiente || s.estado === 'APROBADA') && <section className="space-y-3"><h3 className="text-sm font-semibold">{pendiente ? '¿Qué deseas hacer con esta solicitud?' : 'Administrar reserva'}</h3><div className="flex flex-wrap gap-3">
      {s.estado === 'PENDIENTE' && <AcademicAction icon="check" tone="primary" aria-pressed={accion === 'APROBAR'} disabled={busy} onClick={() => elegir('APROBAR')}>Aceptar solicitud</AcademicAction>}
      {pendiente && <><AcademicAction icon="edit" aria-pressed={accion === 'PROPONER'} disabled={busy} onClick={() => elegir('PROPONER')}>{s.estado === 'PROPUESTA' ? 'Cambiar propuesta' : 'Cambiar aula u horario'}</AcademicAction><AcademicAction icon="close" tone="danger" aria-pressed={accion === 'RECHAZAR'} disabled={busy} onClick={() => elegir('RECHAZAR')}>Rechazar solicitud</AcademicAction></>}
      {s.estado === 'APROBADA' && <AcademicAction icon="trash" tone="danger" disabled={busy} onClick={() => elegir('CANCELAR')}>Cancelar reserva</AcademicAction>}
    </div></section>}
    {s.estado === 'PROPUESTA' && <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><p className="font-semibold">Esperando la confirmación del auxiliar</p>{s.propuesta && <ResumenReservaAula reserva={s.propuesta} />}<p>La alternativa aún no ocupa el aula. Puedes cambiarla o esperar su respuesta.</p></div>}
    <ErrorNotice message={error} />
    {accion && <form className="space-y-4 rounded-lg border border-slate-200 p-4" onSubmit={enviar}>
      <h3 className="font-bold">{labels[accion]}</h3>
      {accion === 'PROPONER' ? <>
        <p className="text-sm text-slate-500">Elige un aula libre. También puedes ajustar la fecha, los días o las horas. El auxiliar tendrá que aceptar esta alternativa.</p>
        <AgendaSolicitudAula value={propuesta.agenda} onChange={agenda => { setValida(false); setPropuesta({ ...propuesta, agenda }); }} desde={s.asignacion.desde} hasta={s.asignacion.hasta} disabled={busy} />
        <AulasDisponiblesSolicitud agenda={propuesta.agenda} idAsignacion={s.asignacion.idAsignacion} numeroEstudiantes={s.numeroEstudiantes} actividad={s.actividad} idSolicitud={s.id} value={propuesta.aula} onChange={aula => { setValida(false); setPropuesta({ ...propuesta, aula }); }} onValida={setValida} disabled={busy} />
      </> : accion === 'APROBAR' ? <p className="text-sm text-slate-600">Se comprobará nuevamente la solicitud original y se agregarán sus sesiones a Horarios. Si el aula ya está ocupada, podrás enviar una alternativa.</p> : <p className="text-sm text-red-800">{accion === 'CANCELAR' ? 'Se retirarán los horarios de esta solicitud y el auxiliar verá el motivo de cancelación.' : 'El auxiliar recibirá el motivo del rechazo en el seguimiento de su solicitud.'}</p>}
      <Field label={accion === 'APROBAR' ? 'Comentario (opcional)' : 'Motivo para el auxiliar'}><textarea required={accion !== 'APROBAR'} minLength={accion === 'APROBAR' ? undefined : 5} maxLength={1000} rows={3} className="input-field" disabled={busy} value={comentario} onChange={e => setComentario(e.target.value)} /></Field>
      <div className="flex flex-wrap justify-end gap-2"><AcademicAction icon="close" disabled={busy} onClick={() => setAccion(null)}>Volver</AcademicAction><AcademicAction type="submit" icon={accion === 'RECHAZAR' || accion === 'CANCELAR' ? 'trash' : 'check'} tone={accion === 'RECHAZAR' || accion === 'CANCELAR' ? 'danger' : 'primary'} disabled={busy || accion === 'PROPONER' && !valida}>{busy ? 'Procesando…' : labels[accion]}</AcademicAction></div>
    </form>}
    <details className="rounded-lg border border-slate-200 p-4" open={s.estado === 'RECHAZADA' || s.estado === 'CANCELADA'}><summary className="cursor-pointer text-sm font-semibold">Ver datos completos y seguimiento</summary><div className="mt-4"><DetalleSolicitudAula solicitud={s} /></div></details>
  </div></Modal>;
}

export default function SolicitudesAulasAdminPage() {
  const load = useCallback(() => solicitudesAulasApi.bandeja(), []);
  const { data, error, loading, refresh } = usePolling(load, 60000);
  const [estado, setEstado] = useState('REVISION'), [query, setQuery] = useState('');
  const [selected, setSelected] = useState<SolicitudAula | null>(null), [success, setSuccess] = useState('');
  const [inicial, setInicial] = useState<AccionRevisionAula | null>(null);
  function abrir(s: SolicitudAula, accion: AccionRevisionAula | null = null) { setSelected(s); setInicial(accion); }
  const normal = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const filtered = (data ?? []).filter(s => (!estado || estado === 'REVISION' ? !estado || ['PENDIENTE', 'PROPUESTA'].includes(s.estado) : s.estado === estado) && normal(`${s.codigo} ${s.nombre} ${s.ci} ${s.ru} ${s.asignacion.materia} ${s.asignacion.siglas.join(' ')} ${s.reserva.aula}`).includes(normal(query.trim())));
  return <div className="space-y-5"><AcademicHeader title="Solicitudes de aulas" description="Revisa el pedido, acepta el aula o propone otra opción. El auxiliar recibirá la respuesta en su cuenta."><AcademicAction icon="refresh" onClick={refresh}>Actualizar</AcademicAction></AcademicHeader>
    <ErrorNotice message={error} retry={refresh} />{success && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}
    <div className="grid gap-3 sm:grid-cols-3">{[['PENDIENTE', 'Por revisar'], ['PROPUESTA', 'Esperando al auxiliar'], ['APROBADA', 'Reservas aprobadas']].map(([value, label]) => <button key={value} className="academic-stat" aria-pressed={estado === value} onClick={() => setEstado(value)}><AdminIcon name={value === 'PENDIENTE' ? 'solicitudes-aulas' : value === 'PROPUESTA' ? 'clock' : 'check'} size={26} /><div><strong>{data?.filter(s => s.estado === value).length ?? 0}</strong><span>{label}</span></div></button>)}</div>
    <div className="academic-surface grid items-end gap-3 p-4 md:grid-cols-[1fr_1fr_auto]"><Field label="Buscar solicitud"><input type="search" className="input-field" placeholder="Código, auxiliar, CI, RU, materia o aula" value={query} onChange={e => setQuery(e.target.value)} /></Field><Field label="Estado"><select className="select-field" value={estado} onChange={e => setEstado(e.target.value)}><option value="REVISION">En revisión y alternativas</option><option value="">Todos los estados</option><option value="PENDIENTE">Pendientes</option><option value="PROPUESTA">Alternativas por confirmar</option><option value="APROBADA">Aprobadas</option><option value="RECHAZADA">Rechazadas</option><option value="CANCELADA">Canceladas</option></select></Field><AcademicAction icon="refresh" onClick={() => { setEstado(''); setQuery(''); }}>Limpiar filtros</AcademicAction></div>
    <p className="text-xs text-slate-500">{filtered.length} de {data?.length ?? 0} solicitudes</p>
    {loading ? <LoadingSpinner /> : !filtered.length ? <Empty>No hay solicitudes para estos filtros.</Empty> : <div className="grid gap-4 xl:grid-cols-2">{filtered.map(s => <article key={s.id} className="academic-surface flex min-w-0 flex-col overflow-hidden">
      <div className="flex-1 space-y-3 p-5"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{s.codigo}</strong><EstadoSolicitudAula estado={s.estado} /></div><h2 className="font-semibold">{s.nombre}</h2><p className="text-sm text-slate-500">{s.asignacion.siglas.join(' / ')} · {s.asignacion.materia} · Paralelo {s.asignacion.grupo} · {s.asignacion.periodo}</p>
        <div className="rounded-lg bg-slate-50 p-3"><p className="mb-2 text-xs font-semibold text-emerald-800">{actividadAulaLabel(s.actividad)} · {s.numeroEstudiantes} estudiantes</p><ResumenReservaAula reserva={s.estado === 'APROBADA' ? s.propuesta ?? s.reserva : s.reserva} /></div><p className="text-xs text-slate-500">{fechaSolicitudAula(s.creadaEn)} · Celular: {s.celular}</p>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/60 p-4"><AcademicAction icon="view" tone="primary" onClick={() => abrir(s)}>{s.estado === 'PENDIENTE' ? 'Revisar solicitud' : 'Ver solicitud'}</AcademicAction>
        {['PENDIENTE', 'PROPUESTA'].includes(s.estado) && <><AcademicAction icon="edit" onClick={() => abrir(s, 'PROPONER')}>{s.estado === 'PROPUESTA' ? 'Editar alternativa' : 'Proponer otra aula'}</AcademicAction><AcademicAction icon="close" tone="danger" onClick={() => abrir(s, 'RECHAZAR')}>Rechazar</AcademicAction></>}
        {s.estado === 'APROBADA' && <AcademicAction icon="trash" tone="danger" onClick={() => abrir(s, 'CANCELAR')}>Cancelar reserva</AcademicAction>}
      </div>
    </article>)}</div>}
    {selected && <RevisarSolicitud key={`${selected.id}-${selected.version}`} solicitud={selected} inicial={inicial} close={() => setSelected(null)} saved={() => { setSuccess('Respuesta registrada. El auxiliar puede verla en el seguimiento de su solicitud.'); refresh(); }} />}
  </div>;
}
