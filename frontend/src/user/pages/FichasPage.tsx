import { FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AxiosError } from "axios";
import { estudiantesApi, FichaEstudiante, JornadaEstudiante } from "../../api/estudiantes.api";
import { LoadingSpinner } from "../../public-site/components/LoadingSpinner";
import { AlertMessage } from "../components/AlertMessage";
import { FichaCard, fechaAtencion } from "../components/FichaCard";
import { PrivacyNotice } from "../../components/PrivacyNotice";

export default function FichasPage() {
  const [params, setParams] = useSearchParams();
  const solicitar = params.get("solicitar") === "1";
  const [fichas, setFichas] = useState<FichaEstudiante[]>([]);
  const [jornadas, setJornadas] = useState<JornadaEstudiante[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [sending, setSending] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [idJornada, setIdJornada] = useState("");
  const [motivo, setMotivo] = useState("");
  const [detalle, setDetalle] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true); setLoadError("");
    Promise.all([estudiantesApi.fichas(), estudiantesApi.jornadas()]).then(([f, j]) => {
      if (active) { setFichas(f.data.data); setJornadas(j.data.data); }
    }).catch(e => { if (active) setLoadError(e instanceof AxiosError ? e.response?.data?.message || "No se pudieron cargar tus fichas y jornadas." : "No se pudieron cargar tus fichas y jornadas."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  const disponibles = jornadas.filter(j => j.disponibles > 0 && !fichas.some(f => f.jornada.idJornada === j.idJornada && f.estado !== "CANCELADA"));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    setError(""); setSuccess("");
    if (!idJornada || !disponibles.some(j => j.idJornada === idJornada)) { setError("Selecciona una jornada disponible."); return; }
    if (motivo.trim().length < 3 || detalle.trim().length < 5) { setError("Completa el motivo y describe tu solicitud (al menos 5 caracteres)."); return; }
    setSending(true);
    try {
      const { data } = await estudiantesApi.solicitar({ idJornada, motivo: motivo.trim(), detalle: detalle.trim() });
      setFichas(prev => [data.data, ...prev]);
      setJornadas(prev => prev.map(j => j.idJornada === idJornada ? { ...j, disponibles: Math.max(0, j.disponibles - 1) } : j));
      setSuccess(`Tu ficha N.º ${data.data.numero} fue registrada para el ${fechaAtencion(data.data.jornada.fecha)}. Puedes consultar su estado aquí.`);
      setMotivo(""); setDetalle(""); setIdJornada(""); setParams({});
    } catch (e) {
      setError(e instanceof AxiosError ? e.response?.data?.message || "No se pudo registrar tu ficha. Intenta nuevamente." : "No se pudo registrar tu ficha. Intenta nuevamente.");
      if (e instanceof AxiosError && e.response?.status === 409) { setIdJornada(""); setAttempt(v => v + 1); }
    } finally { setSending(false); }
  }

  return <div className="container-public space-y-7 py-10">
    <Link to="/usuario/dashboard" className="text-sm font-semibold text-emerald-700">← Volver a mi inicio</Link>
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-bold text-slate-800">Mis fichas de atención</h1><p className="mt-2 text-slate-500">Reserva tu atención en Kardex y consulta el estado de tus solicitudes.</p></div><button className="btn-primary" onClick={() => setParams(solicitar ? {} : { solicitar: "1" })}>{solicitar ? "Ver mis fichas" : "Solicitar nueva ficha"}</button></div>
    {success && <div role="status"><AlertMessage type="success" message={success} /></div>}
    {error && <div role="alert"><AlertMessage type="error" message={error} /></div>}
    {loading ? <LoadingSpinner label="Consultando fichas y disponibilidad..." /> : loadError ? <div role="alert"><AlertMessage type="error" message={loadError} /><button className="btn-secondary mt-4" onClick={() => setAttempt(v => v + 1)}>Reintentar</button></div> : <>
      {solicitar && <section className="card grid gap-8 p-6 sm:p-8 lg:grid-cols-3">
        <div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Atención al estudiante</p><h2 className="mt-3 text-2xl font-bold text-slate-800">Solicitar una ficha</h2><p className="mt-3 text-sm leading-6 text-slate-500">Selecciona una jornada con cupos disponibles e indica qué trámite necesitas realizar. La ficha quedará vinculada a tu cuenta.</p><p className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">El horario corresponde a la jornada de atención. Tu número de ficha identifica tu turno dentro de esa jornada.</p></div>
        {disponibles.length === 0 ? <div className="lg:col-span-2"><p className="rounded-xl bg-slate-50 p-5 text-slate-600">No hay jornadas disponibles para una nueva solicitud. Es posible que los cupos estén agotados o que ya tengas una ficha. Revisa tu historial o consulta más adelante.</p><button className="btn-secondary mt-4" onClick={() => setAttempt(v => v + 1)}>Actualizar disponibilidad</button></div> :
          <form onSubmit={submit} className="space-y-5 lg:col-span-2">
            <fieldset disabled={sending} className="space-y-5">
              <div><label htmlFor="jornada" className="mb-2 block text-sm font-semibold">Jornada de atención</label><select id="jornada" required className="select-field w-full" value={idJornada} onChange={e => setIdJornada(e.target.value)}><option value="">Selecciona fecha y horario</option>{disponibles.map(j => <option key={j.idJornada} value={j.idJornada}>{fechaAtencion(j.fecha)} · {j.horaInicio} – {j.horaFin} · {j.disponibles} cupos</option>)}</select></div>
              <div><label htmlFor="motivo" className="mb-2 block text-sm font-semibold">Motivo de atención</label><input id="motivo" className="input-field" required minLength={3} maxLength={150} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej. Solicitud de certificado de notas" /></div>
              <div><label htmlFor="detalle" className="mb-2 block text-sm font-semibold">Detalle de la solicitud</label><textarea id="detalle" className="textarea-field" required minLength={5} maxLength={2000} rows={4} value={detalle} onChange={e => setDetalle(e.target.value)} placeholder="Cuéntanos qué necesitas para preparar tu atención." /></div>
              <PrivacyNotice context="atencion" />
              <button type="submit" className="btn-primary">{sending ? "Registrando ficha..." : "Confirmar solicitud"}</button>
            </fieldset>
          </form>}
      </section>}
      <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold text-slate-800">Historial de solicitudes</h2><button className="btn-secondary" disabled={sending} onClick={() => setAttempt(v => v + 1)}>Actualizar</button></div>
        {fichas.length ? fichas.map(f => <FichaCard key={f.idFicha} ficha={f} />) : <div className="card p-8 text-center"><h3 className="font-semibold text-slate-800">Todavía no has solicitado una ficha</h3><p className="mt-2 text-sm text-slate-500">Tus solicitudes y su estado aparecerán aquí.</p>{!solicitar && <button className="btn-primary mt-5" onClick={() => setParams({ solicitar: "1" })}>Solicitar mi primera ficha</button>}</div>}
      </section>
    </>}
  </div>;
}
