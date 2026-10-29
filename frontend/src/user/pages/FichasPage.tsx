import { FormEvent, useCallback, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { estudiantesApi } from "../../api/estudiantes.api";
import { LoadingSpinner } from "../../public-site/components/LoadingSpinner";
import { FichaCard, fechaAtencion } from "../components/FichaCard";
import { TableroAtencion } from "../../components/TableroAtencion";
import { mensajeError, usePolling } from "../../hooks/usePolling";
import { useUserAuthStore } from "../../store/userAuthStore";
import { ConfirmDialog } from "../../admin/components/ConfirmDialog";

export default function FichasPage() {
  const [params, setParams] = useSearchParams();
  const solicitar = params.get("solicitar") === "1";
  const usuario = useUserAuthStore(s => s.usuario);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [idJornada, setIdJornada] = useState("");
  const [idTramite, setIdTramite] = useState("");
  const [detalle, setDetalle] = useState("");
  const [cancelar, setCancelar] = useState<string | null>(null);
  const load = useCallback(async () => (await estudiantesApi.atencion()).data.data, []);
  const { data, error: loadError, loading, refresh } = usePolling(load);
  const fichas = data?.fichas ?? [];
  const jornadas = data?.jornadas ?? [];
  const tramites = Array.from(new Map(jornadas.map(j => [j.idTramite ?? "general", j.tramite])).entries());
  const disponibles = jornadas.filter(j => (j.idTramite ?? "general") === idTramite && j.disponibles > 0 && !fichas.some(f => f.jornada.idJornada === j.idJornada && f.estado !== "CANCELADA"));
  const elegida = disponibles.find(j => j.idJornada === idJornada);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sendingRef.current) return;
    setError(""); setSuccess("");
    if (!elegida) { setError("Selecciona una jornada con cupos disponibles."); return; }
    sendingRef.current = true; setSending(true);
    try {
      const { data: response } = await estudiantesApi.solicitar({ idJornada, detalle: detalle.trim() });
      setSuccess(`Tu ficha ${response.data.codigo} está a nombre de ${response.data.solicitante}, para el ${fechaAtencion(response.data.jornada.fecha)}.`);
      setDetalle(""); setIdJornada(""); setIdTramite(""); setParams({});
    } catch (e) { setError(mensajeError(e)); }
    finally { sendingRef.current = false; setSending(false); refresh(); }
  }

  async function confirmarCancelacion() {
    if (!cancelar || sendingRef.current) return;
    sendingRef.current = true; setSending(true); setError(""); setSuccess("");
    try { await estudiantesApi.cancelar(cancelar); setSuccess("Ficha cancelada. El cupo quedó disponible para otro estudiante."); }
    catch (e) { setError(mensajeError(e)); }
    finally { sendingRef.current = false; setSending(false); setCancelar(null); refresh(); }
  }

  return <div className="container-public space-y-8 py-10">
    <Link to="/usuario/dashboard" className="text-sm font-semibold text-emerald-700">← Volver a mi inicio</Link>
    <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">¿Necesitas tu récord o historial académico? <Link to="/usuario/documentos" className="font-semibold underline">Solicita el documento para recogerlo después</Link>.</p>
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-bold text-slate-800">Mis fichas de atención</h1><p className="mt-2 text-slate-500">Reserva tu trámite y sigue el avance de tu turno.</p></div><button className="btn-primary" onClick={() => setParams(solicitar ? {} : { solicitar: "1" })}>{solicitar ? "Ver mis fichas" : "Solicitar nueva ficha"}</button></div>
    {success && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-900">{success}</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
    {loadError && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900">No pudimos actualizar tus fichas. La información puede haber cambiado. <button className="underline" onClick={refresh}>Reintentar</button></p>}
    {loading ? <LoadingSpinner label="Consultando fichas y disponibilidad…" /> : data && <>
      {solicitar && <section className="card grid gap-8 p-6 sm:p-8 lg:grid-cols-3">
        <div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Atención al estudiante</p><h2 className="mt-3 text-2xl font-bold text-slate-800">Generar mi ficha</h2><p className="mt-3 text-sm leading-6 text-slate-500">Elige el trámite y una jornada. Usaremos automáticamente los datos de tu cuenta.</p><div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900"><p className="text-xs font-semibold uppercase">Ficha a nombre de</p><p className="mt-2 font-bold">{usuario?.nombreCompleto}</p><p className="mt-2">Un turno por trámite y jornada. La atención sigue el orden del número de ficha.</p></div></div>
        {jornadas.length === 0 ? <div className="lg:col-span-2"><p className="rounded-xl bg-slate-50 p-5 text-slate-600">No hay jornadas disponibles. Kardex publicará los horarios y cupos aquí.</p><button className="btn-secondary mt-4" onClick={refresh}>Actualizar disponibilidad</button></div> :
          <form onSubmit={submit} className="lg:col-span-2"><fieldset disabled={sending || !!loadError} className="space-y-5">
            <label className="block text-sm font-semibold">Trámite<select required className="select-field mt-2 w-full" value={idTramite} onChange={e => { setIdTramite(e.target.value); setIdJornada(""); }}><option value="">¿Qué necesitas realizar?</option>{tramites.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}</select></label>
            <label className="block text-sm font-semibold">Fecha y horario<select required className="select-field mt-2 w-full" value={elegida ? idJornada : ""} onChange={e => setIdJornada(e.target.value)}><option value="">Selecciona una jornada</option>{disponibles.map(j => <option key={j.idJornada} value={j.idJornada}>{fechaAtencion(j.fecha)} · {j.horaInicio} – {j.horaFin} · {j.disponibles} cupos</option>)}</select></label>
            {idTramite && !disponibles.length && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Este trámite no tiene cupos libres o ya tienes una ficha para las jornadas publicadas. Revisa tus fichas o consulta más adelante.</p>}
            {elegida && <p className="text-sm text-emerald-800">{elegida.puesto} · Aproximadamente {elegida.minutosPorEstudiante} minutos por estudiante.</p>}
            <label className="block text-sm font-semibold">Detalle (opcional)<textarea className="textarea-field mt-2" maxLength={2000} rows={3} value={detalle} onChange={e => setDetalle(e.target.value)} placeholder="Si necesitas aclarar algo sobre tu trámite, escríbelo aquí." /></label>
            <button type="submit" className="btn-primary" disabled={!elegida}>{sending ? "Generando ficha…" : "Generar mi ficha"}</button>
          </fieldset></form>}
      </section>}
      <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold text-slate-800">Mis turnos e historial</h2><button className="btn-secondary" disabled={sending} onClick={refresh}>Actualizar</button></div>
        {fichas.length ? fichas.map(f => <FichaCard key={f.idFicha} ficha={f} onCancelar={() => setCancelar(f.idFicha)} disabled={sending || !!loadError} />) : <div className="card p-8 text-center"><h3 className="font-semibold text-slate-800">Todavía no has solicitado una ficha</h3><p className="mt-2 text-sm text-slate-500">Tus turnos y su estado aparecerán aquí.</p>{!solicitar && <button className="btn-primary mt-5" onClick={() => setParams({ solicitar: "1" })}>Solicitar mi primera ficha</button>}</div>}
      </section>
    </>}
    <TableroAtencion />
    <ConfirmDialog open={!!cancelar} title="Cancelar mi ficha" message="Perderás este turno y su cupo quedará disponible. Si vuelves a solicitarlo, recibirás un nuevo número al final de la cola." confirmLabel="Cancelar ficha" loading={sending} onCancel={() => setCancelar(null)} onConfirm={() => void confirmarCancelacion()} />
  </div>;
}
