import { FichaEstudiante } from "../../api/estudiantes.api";

export function fechaAtencion(fecha: string) {
  return new Date(`${fecha}T12:00:00`).toLocaleDateString("es-BO", { day: "numeric", month: "long", year: "numeric" });
}

export function FichaCard({ ficha, onCancelar, disabled }: { ficha: FichaEstudiante; onCancelar?: () => void; disabled?: boolean }) {
  const hoy = new Date(Date.now() - 4 * 3600000).toISOString().slice(0, 10);
  const pendiente = ["GENERADA", "CONFIRMADA", "EN ESPERA", "REPROGRAMADA"].includes(ficha.estado);
  return <article className="card flex flex-col gap-5 p-6 sm:flex-row sm:items-start">
    <div className="student-ticket-number"><span className="text-xs font-semibold uppercase tracking-widest">Ficha</span><strong className="text-3xl">{String(ficha.numero).padStart(3, "0")}</strong><span className="text-xs font-semibold">J{ficha.jornada.idJornada}</span></div>
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold text-slate-800">{ficha.codigo} · {ficha.jornada.tramite}</h3><span className="badge">{ficha.estado.replace(/_/g, " ")}</span></div>
      <p className="mt-3 font-semibold text-slate-800">{ficha.solicitante}</p><p className="mt-1 text-xs text-slate-500">RU: {ficha.ru} · {ficha.jornada.puesto}</p>
      <p className="mt-2 font-medium text-emerald-800">{fechaAtencion(ficha.jornada.fecha)} · {ficha.jornada.horaInicio} – {ficha.jornada.horaFin}</p>
      <p className="mt-3 whitespace-pre-line break-words text-sm text-slate-600">{ficha.motivo}</p>
      {ficha.estado === "LLAMADA" && ficha.jornada.fecha === hoy && <p role="status" className="mt-4 rounded-xl bg-emerald-100 p-4 font-bold text-emerald-900">¡Es tu turno! Acércate a {ficha.jornada.puesto}.</p>}
      {pendiente && ficha.jornada.fecha >= hoy && <p className="mt-3 text-sm text-slate-600">{ficha.jornada.estado === "INACTIVO" ? "La jornada está pausada. Conservas tu turno." : `${ficha.delante} personas delante de ti · Espera estimada: ${ficha.esperaMinutos} min desde el inicio de la atención o el turno actual.`} <span className="text-xs text-slate-500">El tiempo es orientativo.</span></p>}
      {(pendiente || ficha.estado === "LLAMADA") && ficha.jornada.fecha < hoy && <p className="mt-3 text-sm text-amber-800">La fecha de esta ficha ya pasó. Consulta en Kardex.</p>}
      {onCancelar && pendiente && ficha.jornada.fecha >= hoy && <button className="btn-secondary mt-4" disabled={disabled} onClick={onCancelar}>Cancelar ficha</button>}
      <p className="mt-3 text-xs text-slate-500">Solicitud #{ficha.idFicha} · Registrada el {fechaAtencion(ficha.fechaSolicitud)}</p>
    </div>
  </article>;
}
