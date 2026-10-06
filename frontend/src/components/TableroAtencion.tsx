import { useCallback } from "react";
import { fichasApi } from "../api/fichas.api";
import { usePolling } from "../hooks/usePolling";

// Vista de consulta para visitantes y estudiantes. La presentación se controla en administración.
export function TableroAtencion() {
  const load = useCallback(async () => (await fichasApi.tablero()).data.data, []);
  const { data, error, loading } = usePolling(load);
  return <section className="space-y-4" aria-label="Turnos en atención">
    <h2 className="text-2xl font-bold text-slate-800">Ahora en atención</h2>
    {error && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">No se pudo actualizar. Los turnos mostrados pueden haber cambiado.</p>}
    {loading && <p role="status">Consultando turnos…</p>}
    {data && !data.jornadas.length && <p className="card p-5 text-slate-500">No hay atención programada para hoy.</p>}
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-live="polite">
      {data?.jornadas.map(j => <article key={j.idJornada} className="card p-5"><h3 className="font-bold text-slate-700">{j.tramite}</h3><p className="my-3 text-4xl font-extrabold text-emerald-800">{j.actual?.codigo ?? "—"}</p><p className="text-sm text-slate-500">{j.actual ? j.puesto : j.estado === "INACTIVO" ? "Atención pausada" : "Esperando el próximo llamado"}</p></article>)}
    </div>
  </section>;
}
