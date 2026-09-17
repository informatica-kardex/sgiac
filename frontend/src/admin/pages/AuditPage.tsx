import { useState } from "react";
import { AdminIcon } from "../components/AdminIcon";

const events = [
  { id: 1, date: "2026-09-14", time: "10:12:14", action: "Inicio de sesión", entity: "Usuario", detail: "Acceso al panel administrativo.", user: "Administrador de ejemplo", kind: "Accesos" },
  { id: 2, date: "2026-09-14", time: "09:48:32", action: "Actualización de horario", entity: "Horario", detail: "Cambio de aula para la materia INF-231.", user: "Responsable académico", kind: "Modificaciones" },
  { id: 3, date: "2026-09-14", time: "09:20:08", action: "Publicación de comunicado", entity: "Comunicado", detail: "Publicación del horario de laboratorio.", user: "Responsable académico", kind: "Modificaciones" },
  { id: 4, date: "2026-09-14", time: "09:18:44", action: "Cambio de estado de ficha", entity: "Ficha", detail: "Ficha A-039 marcada como atendida.", user: "Responsable de atención", kind: "Modificaciones" },
  { id: 5, date: "2026-09-14", time: "08:42:19", action: "Inicio de sesión fallido", entity: "Usuario", detail: "Intento de acceso con credenciales incorrectas.", user: "Usuario de ejemplo", kind: "Accesos" },
  { id: 6, date: "2026-09-13", time: "16:10:02", action: "Creación de usuario", entity: "Usuario", detail: "Registro de una cuenta institucional.", user: "Administrador de ejemplo", kind: "Modificaciones" },
];
export default function AuditPage() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [date, setDate] = useState("");
  const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const filtered = events.filter(event => (!kind || event.kind === kind) && (!date || event.date === date) && normalize([event.action, event.user, event.detail, event.entity].join(" ")).includes(normalize(query.trim())));
  return <div className="space-y-6">
    <div><h1 className="text-xl font-bold">Bitácora de auditoría</h1><p className="text-sm text-slate-500">Historial de accesos y operaciones administrativas.</p></div>
    <div role="status" className="flex items-start gap-3 border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><AdminIcon name="auditoria" /><p><strong>Vista de demostración.</strong> Los eventos son ficticios. Puedes probar los filtros para visualizar cómo funcionará esta sección.</p></div>
    <div className="card grid gap-3 p-4 lg:grid-cols-[1fr_190px_180px_auto]">
      <label className="space-y-2 text-xs text-slate-500"><span>Buscar evento</span><input className="input-field" placeholder="Acción, usuario o detalle…" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <label className="space-y-2 text-xs text-slate-500"><span>Tipo de acción</span><select className="select-field" value={kind} onChange={e => setKind(e.target.value)}><option value="">Todas las acciones</option><option>Accesos</option><option>Modificaciones</option></select></label>
      <label className="space-y-2 text-xs text-slate-500"><span>Fecha</span><input className="input-field" type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
      <button className="btn-secondary self-end" onClick={() => { setQuery(""); setKind(""); setDate(""); }}>Limpiar filtros</button>
    </div>
    <section className="card overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead><tr>{["Fecha y hora", "Acción", "Entidad", "Detalle", "Usuario"].map(title => <th key={title} scope="col" className="px-5 py-3">{title}</th>)}</tr></thead>
      <tbody className="divide-y divide-slate-100">{filtered.map(event => <tr key={event.id}><td className="whitespace-nowrap px-5 text-xs text-slate-500">{event.date.split("-").reverse().join("/")}<span className="mt-1 block text-[10px] text-slate-400">{event.time}</span></td><td className="px-5"><span className={`badge ${event.action.includes("fallido") ? "bg-red-50 text-red-700" : event.kind === "Accesos" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>{event.action}</span></td><td className="px-5 text-xs text-slate-500">{event.entity}</td><td className="max-w-xs px-5 text-xs text-slate-600">{event.detail}</td><td className="px-5 text-xs font-medium">{event.user}</td></tr>)}
      {!filtered.length && <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-500">No hay eventos de ejemplo que coincidan con los filtros.</td></tr>}</tbody>
    </table></div><p aria-live="polite" className="border-t border-slate-200 px-5 py-4 text-xs text-slate-500">Mostrando {filtered.length} de {events.length} eventos de ejemplo · Solo lectura</p></section>
  </div>;
}
