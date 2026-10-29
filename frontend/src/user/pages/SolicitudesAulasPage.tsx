import { FormEvent, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { ACTIVIDADES_AULA, PerfilAuxiliarAulas, ReservaAula, SolicitarAulaInput, SolicitudAula, solicitudesAulasApi } from '../../api/solicitudes-aulas.api';
import { AgendaSolicitudAula, AulasDisponiblesSolicitud, DetalleSolicitudAula, EstadoSolicitudAula, ResumenReservaAula, agendaInicial, fechaSolicitudAula } from '../../components/SolicitudAulaUI';
import { ErrorNotice, Field, errorAcademico } from '../../admin/components/AcademicoUI';
import { Modal } from '../../admin/components/Modal';
import { ConfirmDialog } from '../../admin/components/ConfirmDialog';
import { LoadingSpinner } from '../../public-site/components/LoadingSpinner';
import { usePolling } from '../../hooks/usePolling';

function NuevaSolicitud({ perfil, close, saved }: { perfil: PerfilAuxiliarAulas; close: () => void; saved: (s: SolicitudAula) => void }) {
  const [form, setForm] = useState<SolicitarAulaInput>({ idAsignacion: perfil.asignaciones.length === 1 ? perfil.asignaciones[0].idAsignacion : '', celular: perfil.datos?.celular ?? '', numeroEstudiantes: 1, actividad: 'PRACTICA_LABORATORIO', detalle: '', reserva: { aula: '', agenda: agendaInicial() } });
  const [valida, setValida] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const asignacion = perfil.asignaciones.find(a => a.idAsignacion === form.idAsignacion);
  function reserva(value: ReservaAula) { setValida(false); setForm(p => ({ ...p, reserva: value })); }
  async function enviar(event: FormEvent) {
    event.preventDefault(); if (busy || !valida) return; setBusy(true); setError('');
    try { saved(await solicitudesAulasApi.crear(form)); close(); }
    catch (e) { setError(errorAcademico(e)); } finally { setBusy(false); }
  }
  return <Modal title="Solicitud de aula o laboratorio" open onClose={() => !busy && close()} size="wide"><form className="space-y-6" onSubmit={enviar}>
    <p className="text-sm text-slate-500">Kardex · Carrera de Informática · Auxiliar de docencia</p><ErrorNotice message={error} />
    <section><h2 className="mb-3 font-bold">I. Datos del solicitante</h2><div className="grid gap-3 sm:grid-cols-2">
      {[['Nombre completo', perfil.datos?.nombre], ['Correo institucional', perfil.datos?.correo], ['CI', perfil.datos?.ci], ['RU', perfil.datos?.ru]].map(([label, value]) => <Field key={label} label={label!}><input readOnly className="input-field bg-slate-50" value={value ?? ''} /></Field>)}
      <Field label="Nro. celular"><input type="tel" required minLength={7} maxLength={30} className="input-field" value={form.celular} disabled={busy} onChange={e => setForm({ ...form, celular: e.target.value })} placeholder="Ej. 71234567" /></Field>
    </div><p className="mt-2 text-xs text-slate-500">El nombre, correo, CI y RU se toman de tu cuenta institucional.</p></section>
    <section className="space-y-3"><h2 className="font-bold">II. Datos de la materia</h2>
      <Field label="Materia, docente y paralelo"><select required className="select-field" value={form.idAsignacion} disabled={busy} onChange={e => { setValida(false); setForm({ ...form, idAsignacion: e.target.value, reserva: { ...form.reserva, aula: '' } }); }}><option value="">Selecciona tu asignación</option>{perfil.asignaciones.map(a => <option key={a.idAsignacion} value={a.idAsignacion}>{a.siglas.join(' / ')} · {a.materia} · {a.docente} · {a.grupo} · {a.periodo}</option>)}</select></Field>
      <Field label="Nro. de estudiantes"><input required type="number" min={1} max={1000} className="input-field" value={form.numeroEstudiantes || ''} disabled={busy} onChange={e => { setValida(false); setForm({ ...form, numeroEstudiantes: Number(e.target.value) }); }} /></Field>
    </section>
    <section className="space-y-3"><h2 className="font-bold">III. Propósito de la solicitud</h2><Field label="Actividad a realizar"><select className="select-field" value={form.actividad} disabled={busy} onChange={e => { setValida(false); setForm({ ...form, actividad: e.target.value, reserva: { ...form.reserva, aula: '' } }); }}>{Object.entries(ACTIVIDADES_AULA).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
      <Field label="Detalle de la actividad (opcional)"><textarea className="input-field" rows={2} maxLength={1000} disabled={busy} value={form.detalle} onChange={e => setForm({ ...form, detalle: e.target.value })} placeholder="Describe la actividad o los equipos que necesitas." /></Field>
    </section>
    <section className="space-y-3"><h2 className="font-bold">IV. Días y horas</h2><AgendaSolicitudAula value={form.reserva.agenda} onChange={agenda => reserva({ ...form.reserva, agenda })} desde={asignacion?.desde} hasta={asignacion?.hasta} disabled={busy} /></section>
    <section className="space-y-3"><h2 className="font-bold">V. Ambiente solicitado</h2><AulasDisponiblesSolicitud agenda={form.reserva.agenda} idAsignacion={form.idAsignacion} numeroEstudiantes={form.numeroEstudiantes} actividad={form.actividad} value={form.reserva.aula} onChange={aula => reserva({ ...form.reserva, aula })} onValida={setValida} disabled={busy} /></section>
    <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4"><button type="button" className="btn-secondary" disabled={busy} onClick={close}>Cancelar</button><button className="btn-primary" disabled={busy || !valida || !asignacion}>{busy ? 'Enviando…' : 'Enviar solicitud a Kardex'}</button></div>
  </form></Modal>;
}

export default function SolicitudesAulasPage() {
  const load = useCallback(async () => { const [perfil, solicitudes] = await Promise.all([solicitudesAulasApi.perfil(), solicitudesAulasApi.mias()]); return { perfil, solicitudes }; }, []);
  const { data, loading, error: loadError, refresh } = usePolling(load, 60000);
  const [open, setOpen] = useState(false), [detalle, setDetalle] = useState<SolicitudAula | null>(null);
  const [confirmar, setConfirmar] = useState<{ solicitud: SolicitudAula; accion: 'aceptar' | 'declinar' | 'cancelar' } | null>(null);
  const [comentario, setComentario] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('');
  async function actuar() {
    if (!confirmar || busy) return; setBusy(true); setError(''); setSuccess('');
    try {
      const { solicitud, accion } = confirmar;
      const actual = accion === 'cancelar' ? await solicitudesAulasApi.cancelar(solicitud) : await solicitudesAulasApi.responder(solicitud, accion === 'aceptar', comentario);
      setDetalle(actual); setConfirmar(null); setComentario(''); refresh();
      setSuccess(accion === 'aceptar' ? 'Alternativa aceptada. El aula quedó reservada y figura en Horarios.' : accion === 'declinar' ? 'Kardex recibió tu respuesta y podrá proponerte otra opción.' : 'Solicitud cancelada.');
    } catch (e) { setConfirmar(null); setError(errorAcademico(e)); refresh(); } finally { setBusy(false); }
  }
  const propuestas = data?.solicitudes.filter(s => s.estado === 'PROPUESTA').length ?? 0;
  return <div className="container-public space-y-6 py-8">
    <div className="rounded-2xl bg-emerald-900 p-6 text-white"><p className="text-xs uppercase tracking-widest text-emerald-200">Kardex · Auxiliares de docencia</p><h1 className="mt-2 text-3xl font-bold">Solicitud de aula o laboratorio</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-50">Solicita un aula de Informática o LASIN para un día, dos días o todo el semestre. Kardex revisará tu solicitud. Si propone otra aula u horario, podrás aceptarlo o pedir otra opción.</p></div>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">Mis solicitudes</h2><div className="flex gap-2"><button className="btn-secondary" disabled={busy} onClick={refresh}>Actualizar</button><button className="btn-primary" disabled={busy || !data?.perfil.habilitado || !data.perfil.asignaciones.length || Boolean(loadError)} onClick={() => setOpen(true)}>+ Nueva solicitud</button></div></div>
    <ErrorNotice message={loadError} retry={refresh} />{!detalle && <ErrorNotice message={error} />}{success && <p role="status" className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">{success}</p>}
    {propuestas > 0 && <p role="status" className="rounded-lg bg-blue-50 p-4 text-sm text-blue-900">Tienes {propuestas} {propuestas === 1 ? 'alternativa pendiente' : 'alternativas pendientes'} de respuesta. Abre la solicitud para revisar el aula y horario propuestos.</p>}
    {loading ? <LoadingSpinner /> : data && <>
      {!data.perfil.habilitado ? <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">Para enviar solicitudes debes estar habilitado como auxiliar. Consulta con el administrador. Puedes seguir consultando tus solicitudes anteriores.</p> : !data.perfil.asignaciones.length && <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">No tienes materias asignadas en un periodo vigente. Pide al administrador que vincule tu auxiliaría con la materia y el docente.</p>}
      {!data.solicitudes.length && <div className="card p-8 text-center text-slate-500">Todavía no enviaste solicitudes de aulas.</div>}
      <div className="grid gap-4 lg:grid-cols-2">{data.solicitudes.map(s => <article key={s.id} className="card space-y-3 p-5"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{s.codigo}</strong><EstadoSolicitudAula estado={s.estado} /></div><h3 className="font-semibold">{s.asignacion.siglas.join(' / ')} · {s.asignacion.materia}</h3><p className="text-xs text-slate-500">Paralelo {s.asignacion.grupo} · {s.asignacion.periodo} · {fechaSolicitudAula(s.creadaEn)}</p><ResumenReservaAula reserva={s.estado === 'APROBADA' ? s.propuesta ?? s.reserva : s.reserva} />
        <button className="btn-secondary" onClick={() => { setDetalle(s); setError(''); setComentario(''); }}>{s.estado === 'PROPUESTA' ? 'Revisar alternativa' : 'Ver solicitud'}</button>
      </article>)}</div>
    </>}
    <Link className="inline-block text-sm text-emerald-700 underline" to="/usuario/dashboard">Volver a mi inicio</Link>
    {open && data && <NuevaSolicitud perfil={data.perfil} close={() => setOpen(false)} saved={s => { setSuccess(`${s.codigo}: solicitud enviada a Kardex.`); refresh(); }} />}
    {detalle && <Modal title="Seguimiento de solicitud" open onClose={() => !busy && setDetalle(null)} size="wide"><div className="space-y-5"><DetalleSolicitudAula solicitud={detalle} /><ErrorNotice message={error} />
      {detalle.estado === 'PROPUESTA' && <div className="space-y-3 border-t pt-4"><Field label="Comentario para Kardex (opcional)"><textarea maxLength={1000} rows={2} className="input-field" value={comentario} disabled={busy} onChange={e => setComentario(e.target.value)} /></Field><div className="flex flex-wrap gap-2"><button className="btn-primary" disabled={busy || !data?.perfil.habilitado} onClick={() => setConfirmar({ solicitud: detalle, accion: 'aceptar' })}>Aceptar alternativa y reservar</button><button className="btn-secondary" disabled={busy} onClick={() => setConfirmar({ solicitud: detalle, accion: 'declinar' })}>Pedir otra opción</button></div></div>}
      {['PENDIENTE', 'PROPUESTA'].includes(detalle.estado) && <button className="btn-ghost text-red-600" disabled={busy} onClick={() => setConfirmar({ solicitud: detalle, accion: 'cancelar' })}>Cancelar solicitud</button>}
      {detalle.estado === 'APROBADA' && <p className="text-sm text-emerald-800">Reserva confirmada. Si necesitas cancelarla, comunícate con Kardex e indica {detalle.codigo}.</p>}
    </div></Modal>}
    <ConfirmDialog open={Boolean(confirmar)} title={confirmar?.accion === 'aceptar' ? 'Aceptar la alternativa' : confirmar?.accion === 'declinar' ? 'Pedir otra opción' : 'Cancelar solicitud'} message={confirmar?.accion === 'aceptar' ? 'Se reservarán el aula y los horarios de la alternativa, si siguen disponibles.' : confirmar?.accion === 'declinar' ? 'La solicitud volverá a revisión de Kardex. Esta alternativa no reservará ningún aula.' : 'La solicitud se cerrará sin reservar un aula.'} confirmLabel="Confirmar" onCancel={() => setConfirmar(null)} onConfirm={actuar} loading={busy} />
  </div>;
}
