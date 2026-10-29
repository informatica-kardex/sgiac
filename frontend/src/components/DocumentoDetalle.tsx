import { ESTADOS_DOCUMENTO, EstadoDocumento, SolicitudDocumento } from "../api/documentos.api";

export const nombrePorApellido = (s: SolicitudDocumento) => s.apellidos && s.nombres ? `${s.apellidos}, ${s.nombres}` : s.solicitante;

export function fechaDocumento(fecha: string | null) {
  return fecha ? new Intl.DateTimeFormat("es-BO", { timeZone: "America/La_Paz", dateStyle: "medium", timeStyle: "short" }).format(new Date(fecha)) : "Por confirmar";
}
export const fechaInputBolivia = (fecha: string) => new Date(Date.parse(fecha) - 4 * 3600000).toISOString().slice(0, 16);
export const fechaDesdeBolivia = (fecha: string) => new Date(`${fecha}:00-04:00`).toISOString();
export function DocumentoEstado({ estado }: { estado: EstadoDocumento }) {
  const color = estado === "LISTA" ? "bg-emerald-100 text-emerald-800" : estado === "RECHAZADA" ? "bg-red-100 text-red-800" : estado === "EN_PREPARACION" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-700";
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${color}`}>{ESTADOS_DOCUMENTO[estado]}</span>;
}
export function DocumentoDetalle({ solicitud: s, historial = true }: { solicitud: SolicitudDocumento; historial?: boolean }) {
  return <div className="space-y-4 text-sm">
    <div className={`rounded-xl border p-4 ${s.estado === "LISTA" ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
      <p className="font-bold">{s.estado === "LISTA" ? "Tu documento está listo. Puedes pasar a recogerlo en la fecha indicada." : s.estado === "ENTREGADA" ? "Documento entregado por Kardex." : ["RECHAZADA", "CANCELADA"].includes(s.estado) ? "Esta solicitud está cerrada." : "Estamos gestionando tu solicitud. Espera la confirmación antes de acudir."}</p>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div><dt className="text-slate-500">{s.fechaRecojo ? "Recojo confirmado a partir de" : "Fecha estimada · sujeta a confirmación"}</dt><dd className="mt-1 font-semibold">{fechaDocumento(s.fechaRecojo ?? s.estimadaEn)}</dd></div>
        <div><dt className="text-slate-500">Lugar de recojo</dt><dd className="mt-1 font-semibold">{s.lugar}</dd></div>
        <div><dt className="text-slate-500">Hojas en blanco que debes traer</dt><dd className="mt-1 font-bold">{s.hojas === null ? "Se indicarán cuando el documento esté listo" : s.hojas === 0 ? "No necesitas traer hojas" : `${s.hojas} ${s.hojas === 1 ? "hoja" : "hojas"}`}</dd></div>
        <div><dt className="text-slate-500">Solicitante</dt><dd className="mt-1 font-semibold">{s.solicitante} · RU {s.ru}</dd></div>
      </dl>
      <p className="mt-4 whitespace-pre-wrap break-words text-slate-600">{s.requisitos}</p>
      <p className="mt-3 text-xs text-slate-500">Todos los horarios se muestran en hora de Bolivia. Presenta tu identificación y el código de esta ficha.</p>
    </div>
    <p><span className="font-semibold">Motivo:</span> {s.motivo}</p>
    {s.detalle && <p className="whitespace-pre-wrap break-words"><span className="font-semibold">Detalle:</span> {s.detalle}</p>}
    {historial && <details className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer font-semibold">Seguimiento de la solicitud</summary><ol className="mt-4 space-y-4">{s.eventos.map(e => <li key={e.id} className="border-l-2 border-emerald-200 pl-4"><p className="text-xs text-slate-500">{fechaDocumento(e.fecha)}</p><p className="mt-1 whitespace-pre-wrap break-words">{e.descripcion}</p></li>)}</ol></details>}
  </div>;
}
