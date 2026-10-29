import { useEffect, useState } from 'react';
import { actividadAulaLabel, AgendaAula, AulaDisponible, DIAS_AULA, ReservaAula, SolicitudAula, solicitudesAulasApi } from '../api/solicitudes-aulas.api';
import { ErrorNotice, Field, errorAcademico } from '../admin/components/AcademicoUI';

export const hoyBolivia = () => new Date(Date.now() - 4 * 3600000).toISOString().slice(0, 10);
export const fechaSolicitudAula = (s: string) => new Date(s).toLocaleString('es-BO', { timeZone: 'America/La_Paz', dateStyle: 'medium', timeStyle: 'short' });
export const diaAula = (fecha: string) => DIAS_AULA[new Date(`${fecha}T12:00:00Z`).getUTCDay() - 1] ?? 'LUNES';
export const agendaInicial = (): AgendaAula => ({ alcance: 'DIA', sesiones: [{ dia: diaAula(hoyBolivia()), fecha: hoyBolivia(), horaInicio: '08:00', horaFin: '10:00' }] });
const estadoLabels = { PENDIENTE: 'Pendiente de revisión', PROPUESTA: 'Alternativa por confirmar', APROBADA: 'Aula reservada', RECHAZADA: 'Solicitud rechazada', CANCELADA: 'Cancelada' };
export function EstadoSolicitudAula({ estado }: { estado: SolicitudAula['estado'] }) {
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${estado === 'APROBADA' ? 'bg-emerald-100 text-emerald-800' : estado === 'PROPUESTA' ? 'bg-blue-100 text-blue-800' : estado === 'PENDIENTE' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>{estadoLabels[estado]}</span>;
}
export function ResumenReservaAula({ reserva }: { reserva: ReservaAula }) {
  return <div className="space-y-1 text-sm"><p className="font-semibold">Aula: {reserva.aula}</p><p>{reserva.agenda.alcance === 'SEMESTRE' ? 'Todo el semestre · horario semanal' : reserva.agenda.alcance === 'DOS_DIAS' ? 'Dos días' : 'Solo un día'}</p>
    {reserva.agenda.sesiones.map((s, i) => <p key={i}>{s.dia}{s.fecha ? ` · ${s.fecha.split('-').reverse().join('/')}` : ''} · {s.horaInicio} a {s.horaFin}</p>)}
  </div>;
}
export function AgendaSolicitudAula({ value, onChange, desde, hasta, disabled = false }: {
  value: AgendaAula; onChange: (v: AgendaAula) => void; desde?: string; hasta?: string; disabled?: boolean;
}) {
  const min = desde && desde > hoyBolivia() ? desde : hoyBolivia();
  function cambiarDuracion(alcance: AgendaAula['alcance']) {
    if (alcance === 'SEMESTRE') return onChange({ alcance, sesiones: value.sesiones.map(s => ({ ...s, fecha: null })) });
    const primera = value.sesiones[0].fecha ?? min;
    const siguiente = new Date(`${primera}T12:00:00Z`);
    siguiente.setUTCDate(siguiente.getUTCDate() + 1);
    if (siguiente.getUTCDay() === 0) siguiente.setUTCDate(siguiente.getUTCDate() + 1);
    const segunda = siguiente.toISOString().slice(0, 10);
    onChange({ alcance, sesiones: Array.from({ length: alcance === 'DOS_DIAS' ? 2 : 1 }, (_, i) => {
      const sesion = value.sesiones[i] ?? value.sesiones[0];
      const fecha = value.sesiones[i]?.fecha ?? (i === 0 ? primera : hasta && segunda > hasta ? null : segunda);
      return { ...sesion, fecha, dia: fecha ? diaAula(fecha) : sesion.dia };
    }) });
  }
  return <fieldset disabled={disabled} className="space-y-4">
    <Field label="Duración de la reserva"><select className="select-field" value={value.alcance} onChange={e => cambiarDuracion(e.target.value as AgendaAula['alcance'])}><option value="DIA">Solo un día</option><option value="DOS_DIAS">Dos días</option><option value="SEMESTRE">Todo el semestre (semanal)</option></select></Field>
    {value.alcance === 'DOS_DIAS' && <p className="text-xs text-slate-500">Elige dos fechas diferentes y el horario de cada una. El aula debe estar disponible ambos días.</p>}
    {value.alcance === 'DOS_DIAS' && value.sesiones[0].fecha && value.sesiones[0].fecha === value.sesiones[1]?.fecha && <p role="alert" className="text-sm text-red-700">Selecciona dos fechas diferentes.</p>}
    {value.alcance === 'SEMESTRE' && <p className="text-xs text-slate-500">Se comprobarán todas las semanas del periodo {desde} a {hasta}, incluidas las reservas puntuales. Selecciona los días y horas de cada sesión.</p>}
    {value.sesiones.map((s, i) => <div key={i} className="grid items-end gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
      {value.alcance !== 'SEMESTRE' ? <Field label={value.alcance === 'DOS_DIAS' ? `Fecha · día ${i + 1}` : 'Fecha'}><input required type="date" className="input-field" min={min} max={hasta} value={s.fecha ?? ''} onChange={e => onChange({ ...value, sesiones: value.sesiones.map((v, n) => n === i ? { ...v, fecha: e.target.value || null, dia: diaAula(e.target.value) } : v) })} />{s.fecha && new Date(`${s.fecha}T12:00:00Z`).getUTCDay() === 0 && <span className="block text-xs text-red-700">Elige una fecha de lunes a sábado.</span>}</Field> :
        <Field label={`Día · sesión ${i + 1}`}><select className="select-field" value={s.dia} onChange={e => onChange({ ...value, sesiones: value.sesiones.map((v, n) => n === i ? { ...v, dia: e.target.value as typeof s.dia } : v) })}>{DIAS_AULA.map(d => <option key={d}>{d}</option>)}</select></Field>}
      <Field label={`Desde · sesión ${i + 1}`}><input required type="time" min="07:00" max="21:59" className="input-field" value={s.horaInicio} onChange={e => onChange({ ...value, sesiones: value.sesiones.map((v, n) => n === i ? { ...v, horaInicio: e.target.value } : v) })} /></Field>
      <Field label={`Hasta · sesión ${i + 1}`}><input required type="time" min="07:00" max="22:00" className="input-field" value={s.horaFin} onChange={e => onChange({ ...value, sesiones: value.sesiones.map((v, n) => n === i ? { ...v, horaFin: e.target.value } : v) })} /></Field>
      {value.alcance === 'SEMESTRE' && value.sesiones.length > 1 && <button type="button" className="btn-secondary text-red-700" onClick={() => onChange({ ...value, sesiones: value.sesiones.filter((_, n) => n !== i) })}>Quitar</button>}
    </div>)}
    {value.alcance === 'SEMESTRE' && value.sesiones.length < 6 && <button type="button" className="btn-secondary" onClick={() => onChange({ ...value, sesiones: [...value.sesiones, { dia: DIAS_AULA.find(d => !value.sesiones.some(s => s.dia === d)) ?? 'LUNES', fecha: null, horaInicio: '08:00', horaFin: '10:00' }] })}>+ Añadir día y horario</button>}
  </fieldset>;
}
export function AulasDisponiblesSolicitud({ agenda, idAsignacion, numeroEstudiantes, actividad, idSolicitud, value, onChange, onValida, disabled = false }: {
  agenda: AgendaAula; idAsignacion: string; numeroEstudiantes: number; actividad: string; idSolicitud?: string; value: string;
  onChange: (codigo: string) => void; onValida: (valida: boolean) => void; disabled?: boolean;
}) {
  const [state, setState] = useState<{ key: string; aulas: AulaDisponible[]; error: string; loading: boolean }>({ key: '', aulas: [], error: '', loading: false });
  const [intento, setIntento] = useState(0);
  const key = JSON.stringify({ agenda, idAsignacion, numeroEstudiantes, actividad, idSolicitud, intento });
  const valid = Boolean(idAsignacion && numeroEstudiantes > 0 && numeroEstudiantes <= 1000 &&
    (agenda.alcance !== 'DOS_DIAS' || agenda.sesiones.length === 2 && new Set(agenda.sesiones.map(s => s.fecha)).size === 2) &&
    agenda.sesiones.every(s => s.horaInicio >= '07:00' && s.horaInicio < s.horaFin && s.horaFin <= '22:00' && (agenda.alcance === 'SEMESTRE' || s.fecha && new Date(`${s.fecha}T12:00:00Z`).getUTCDay() !== 0)));
  useEffect(() => {
    let active = true;
    const p = JSON.parse(key) as { agenda: AgendaAula; idAsignacion: string; numeroEstudiantes: number; actividad: string; idSolicitud?: string };
    setState({ key, aulas: [], error: '', loading: valid });
    if (!valid) return;
    const timer = setTimeout(() => {
      const request = p.idSolicitud ? solicitudesAulasApi.disponibilidadAdmin(p.idSolicitud, p.agenda) : solicitudesAulasApi.disponibilidad({ agenda: p.agenda, idAsignacion: p.idAsignacion, numeroEstudiantes: p.numeroEstudiantes, actividad: p.actividad });
      request.then(aulas => { if (active) setState({ key, aulas, error: '', loading: false }); })
        .catch(e => { if (active) setState({ key, aulas: [], error: errorAcademico(e), loading: false }); });
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [key, valid]);
  const actual = state.key === key;
  const lista = actual ? state.aulas : [];
  const valida = Boolean(actual && !state.loading && !state.error && lista.some(a => a.codigo === value && a.disponible));
  useEffect(() => { onValida(valida); }, [onValida, valida, value, key]);
  return <fieldset disabled={disabled} className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold">{actividad === 'PRACTICA_LABORATORIO' ? 'Laboratorios' : actividad === 'CLASE_TEORICA' ? 'Aulas para clase teórica' : 'Aulas y laboratorios'}</p><button type="button" className="btn-secondary" disabled={!valid || state.loading} onClick={() => setIntento(i => i + 1)}>Actualizar disponibilidad</button></div>
    {!valid ? <p className="text-sm text-slate-500">Selecciona una materia, cantidad de estudiantes y un horario válido para consultar aulas.</p> : !actual || state.loading ? <p role="status" className="text-sm text-slate-500">Comprobando aulas y horarios…</p> : <>
      <ErrorNotice message={state.error} />
      {!state.error && <p role="status" className="text-xs text-slate-500">{lista.filter(a => a.disponible).length} disponibles de {lista.length}. Los ambientes ocupados no se pueden seleccionar.</p>}
      <div className="grid max-h-80 gap-3 overflow-y-auto sm:grid-cols-2">{lista.map(a => <label key={a.codigo} className={`flex items-start gap-3 rounded-lg border p-3 ${!a.disponible ? 'cursor-not-allowed border-slate-200 bg-slate-50' : value === a.codigo ? 'border-emerald-600 bg-emerald-50' : 'cursor-pointer border-slate-200 bg-white hover:border-emerald-400'}`}>
        <input type="radio" name="aulaSolicitud" value={a.codigo} checked={value === a.codigo} disabled={!a.disponible || disabled} className="mt-1" onChange={() => onChange(a.codigo)} />
        <span className="min-w-0 space-y-1 text-sm"><strong className="block">{a.nombre || a.codigo}</strong><span className="block text-xs text-slate-500">{a.capacidad ? `Capacidad: ${a.capacidad} estudiantes` : 'Capacidad sin registrar'}</span><span className={`block text-xs ${a.disponible ? 'text-emerald-700' : 'text-red-700'}`}>{a.disponible ? 'Disponible' : a.motivo}</span></span>
      </label>)}</div>
      {!state.error && !lista.some(a => a.disponible) && <p className="text-sm text-amber-800">No hay ambientes libres para estas condiciones. Cambia la fecha o el horario.</p>}
    </>}
    {value && !valida && !state.loading && <p className="text-sm text-amber-800">El aula seleccionada debe volver a comprobarse o ya no está disponible.</p>}
    <p className="text-xs text-slate-500">Enviar una solicitud o una propuesta no bloquea el aula. La disponibilidad se comprueba nuevamente al confirmar la reserva.</p>
  </fieldset>;
}
export function DetalleSolicitudAula({ solicitud: s }: { solicitud: SolicitudAula }) {
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><strong>{s.codigo}</strong><EstadoSolicitudAula estado={s.estado} /></div>
    <p className="text-xs text-slate-500">Solicitada el {fechaSolicitudAula(s.creadaEn)} · Periodo {s.asignacion.periodo}</p>
    <section className="rounded-lg border border-slate-200 p-4"><h3 className="mb-3 font-bold">I. Datos del solicitante</h3><dl className="grid gap-3 text-sm sm:grid-cols-2">
      {[['Auxiliar de docencia', s.nombre], ['Correo institucional', s.correo], ['CI', s.ci], ['RU', s.ru], ['Celular', s.celular]].map(([label, text]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="break-words font-medium">{text}</dd></div>)}
    </dl></section>
    <section><h3 className="mb-2 font-bold">II. Materia y actividad</h3><p className="text-sm">{s.asignacion.siglas.join(' / ')} · {s.asignacion.materia} · Paralelo {s.asignacion.grupo}</p><p className="text-sm text-slate-500">Docente: {s.asignacion.docente} · {s.numeroEstudiantes} estudiantes</p><p className="mt-2 text-sm">{actividadAulaLabel(s.actividad)}</p>{s.detalle && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{s.detalle}</p>}</section>
    <section className="rounded-lg bg-slate-50 p-4"><h3 className="mb-2 font-bold">III. Solicitud original</h3><ResumenReservaAula reserva={s.reserva} /><p className="mt-2 text-xs text-slate-500">Periodo: {s.asignacion.desde} a {s.asignacion.hasta}</p></section>
    {s.propuesta && <section className="rounded-lg border border-blue-200 bg-blue-50 p-4"><h3 className="mb-2 font-bold text-blue-900">{s.estado === 'APROBADA' ? 'IV. Alternativa aceptada y reservada' : 'IV. Alternativa de Kardex'}</h3><ResumenReservaAula reserva={s.propuesta} />{s.estado === 'PROPUESTA' && <p className="mt-3 text-sm text-blue-900">El auxiliar debe aceptar esta opción para reservar el aula.</p>}</section>}
    <details className="rounded-lg border border-slate-200 p-4" open={s.estado === 'RECHAZADA' || s.estado === 'CANCELADA'}><summary className="cursor-pointer font-semibold">Respuestas y seguimiento</summary><ol className="mt-3 space-y-3">{s.historial.map((e, i) => <li key={i} className="border-l-2 border-slate-200 pl-3 text-sm"><p className="text-xs text-slate-500">{fechaSolicitudAula(e.fecha)} · {e.autor}</p><p className="whitespace-pre-wrap">{e.comentario}</p>{e.reserva && <ResumenReservaAula reserva={e.reserva} />}</li>)}</ol></details>
  </div>;
}
