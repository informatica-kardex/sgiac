import { FichaEstudiante } from "../../api/estudiantes.api";

export function fechaAtencion(fecha: string) {
  return new Date(`${fecha}T12:00:00`).toLocaleDateString("es-BO", { day: "numeric", month: "long", year: "numeric" });
}

export function FichaCard({ ficha }: { ficha: FichaEstudiante }) {
  return <article className="card flex flex-col gap-5 p-6 sm:flex-row sm:items-start">
    <div className="student-ticket-number"><span className="text-xs font-semibold uppercase tracking-widest">Ficha</span><strong className="text-4xl">{String(ficha.numero).padStart(3, "0")}</strong></div>
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold text-slate-800">Atención Kardex</h3><span className="badge">{ficha.estado.replace(/_/g, " ")}</span></div>
      <p className="mt-2 font-medium text-emerald-800">{fechaAtencion(ficha.jornada.fecha)} · {ficha.jornada.horaInicio} – {ficha.jornada.horaFin}</p>
      <p className="mt-3 whitespace-pre-line break-words text-sm text-slate-600">{ficha.motivo}</p>
      <p className="mt-3 text-xs text-slate-500">Solicitud #{ficha.idFicha} · Registrada el {fechaAtencion(ficha.fechaSolicitud)}</p>
    </div>
  </article>;
}
