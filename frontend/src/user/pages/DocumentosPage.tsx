import { FormEvent, useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { createPortal } from "react-dom";
import { documentosApi, SolicitudDocumento } from "../../api/documentos.api";
import { DocumentoDetalle, DocumentoEstado, fechaDocumento } from "../../components/DocumentoDetalle";
import { mensajeError, usePolling } from "../../hooks/usePolling";
import { LoadingSpinner } from "../../public-site/components/LoadingSpinner";
import { ConfirmDialog } from "../../admin/components/ConfirmDialog";
import "../../styles/documentos.css";
import { TelegramVinculo } from "../components/TelegramVinculo";

export default function DocumentosPage() {
  const load = useCallback(async () => (await documentosApi.portal()).data.data, []);
  const { data, error: loadError, loading, refresh } = usePolling(load, 30000);
  const [idTipo, setIdTipo] = useState("");
  const [motivo, setMotivo] = useState("Beca Comedor");
  const [detalle, setDetalle] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [cancelar, setCancelar] = useState<SolicitudDocumento | null>(null);
  const [imprimir, setImprimir] = useState<SolicitudDocumento | null>(null);
  const tipos = data?.tipos ?? [];
  const solicitudes = data?.solicitudes ?? [];
  const elegido = tipos.find(t => t.id === idTipo);
  const duplicada = solicitudes.some(s => s.idTipo === idTipo && ["SOLICITADA", "EN_PREPARACION", "LISTA"].includes(s.estado));
  async function enviar(e: FormEvent) {
    e.preventDefault(); if (lock.current || !elegido?.disponible || duplicada) return;
    lock.current = true; setBusy(true); setError(""); setSuccess("");
    try {
      const s = (await documentosApi.solicitar({ idTipo, motivo, detalle })).data.data;
      setSuccess(`Solicitud recibida. Tu ficha es ${s.codigo}. Guarda este código y espera la confirmación de recojo.`);
      setIdTipo(""); setDetalle("");
    } catch (e) { setError(mensajeError(e)); }
    finally { lock.current = false; setBusy(false); refresh(); }
  }
  async function cancelarSolicitud() {
    if (!cancelar || lock.current) return;
    lock.current = true; setBusy(true); setError(""); setSuccess("");
    try { await documentosApi.cancelar(cancelar.id); setSuccess("Solicitud cancelada."); }
    catch (e) { setError(mensajeError(e)); }
    finally { lock.current = false; setBusy(false); setCancelar(null); refresh(); }
  }
  return <div className="container-public space-y-8 py-10">
    <Link to="/usuario/dashboard" className="text-sm font-semibold text-emerald-700">← Volver a mi inicio</Link>
    <div className="documentos-hero rounded-2xl p-6 text-white sm:p-9"><p className="text-xs font-semibold uppercase tracking-widest text-emerald-200">Kardex · Trámites a distancia</p><h1 className="mt-3 text-3xl font-bold">Mis documentos académicos</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50">Solicita tu récord o historial desde tu cuenta. Kardex prepara el documento y confirma cuándo recogerlo con tu ficha y las hojas indicadas.</p><ol className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm"><li>1. Envía tu solicitud</li><li>2. Espera la confirmación</li><li>3. Recoge con tu ficha</li></ol></div>
    {success && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-900">{success}</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
    {loadError && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900">{loadError} <button className="underline" onClick={refresh}>Reintentar</button></p>}
    {loading ? <LoadingSpinner label="Consultando documentos y solicitudes…" /> : data && <>
      <section className="card grid gap-8 p-6 lg:grid-cols-3">
        <div><h2 className="text-xl font-bold text-slate-800">Solicitar un documento</h2><p className="mt-3 text-sm leading-6 text-slate-500">Los periodos, plazos y requisitos son definidos por Kardex. Una solicitud activa por tipo de documento.</p><p className="mt-4 text-sm text-slate-600">El plazo es en horas corridas y la fecha estimada se ajusta a los días y horarios de atención.</p></div>
        <form onSubmit={enviar} className="lg:col-span-2"><fieldset disabled={busy || !!loadError} className="space-y-4">
          <label className="block text-sm font-semibold">Documento<select className="select-field mt-2 w-full" required value={idTipo} onChange={e => setIdTipo(e.target.value)}><option value="">Selecciona el documento</option>{tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}{!t.disponible ? " · No disponible" : ""}</option>)}</select></label>
          {!tipos.some(t => t.disponible) && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Actualmente no hay solicitudes habilitadas. Consulta los periodos publicados aquí; tus solicitudes anteriores siguen disponibles abajo.</p>}
          {elegido && <div className="rounded-xl bg-slate-50 p-4 text-sm leading-6"><p>{elegido.descripcion}</p><p className="mt-2 font-semibold">Plazo estimado: {elegido.plazoHoras} horas</p><p>La cantidad de hojas se indicará cuando el documento esté listo.</p><p>{elegido.lugar} · {elegido.horaInicio} a {elegido.horaFin}</p><p>Días: {elegido.diasAtencion.map(d => ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][d]).join(", ")}</p>{elegido.desde && <p>Periodo de solicitudes: {fechaDocumento(elegido.desde)} al {fechaDocumento(elegido.hasta)} (Bolivia).</p>}<p className="mt-2 whitespace-pre-wrap">{elegido.requisitos}</p><p className="mt-2 text-emerald-800">{elegido.correoHabilitado ? "Te avisaremos al correo verificado de tu cuenta cuando esté listo. También puedes consultar el estado aquí." : "Consulta el estado en esta página. El aviso por correo no está habilitado para este trámite."}</p>{!elegido.disponible && <p className="mt-2 font-semibold text-amber-800">La recepción de este documento está cerrada o fuera del periodo habilitado.</p>}</div>}
          <label className="block text-sm font-semibold">¿Para qué lo necesitas?<input required minLength={3} maxLength={500} className="input-field mt-2" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej. Beca Comedor" /></label>
          <label className="block text-sm font-semibold">Detalle adicional (opcional)<textarea className="textarea-field mt-2" rows={3} maxLength={2000} value={detalle} onChange={e => setDetalle(e.target.value)} placeholder="Indica si necesitas un periodo académico específico." /></label>
          {duplicada && <p role="status" className="text-sm text-amber-800">Ya tienes una solicitud activa de este documento. Consulta su avance abajo.</p>}
          <button className="btn-primary" disabled={!elegido?.disponible || duplicada}>{busy ? "Enviando…" : "Enviar solicitud"}</button>
        </fieldset></form>
      </section>
      <TelegramVinculo />
      <section className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-bold text-slate-800">Mis solicitudes y fichas de recojo</h2><button className="btn-secondary" onClick={refresh}>Actualizar</button></div>
        {!solicitudes.length && <div className="card p-8 text-center text-slate-500">Todavía no tienes solicitudes de documentos. Cuando envíes una, podrás seguirla aquí.</div>}
        {solicitudes.map(s => <article key={s.id} className="card space-y-5 p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-mono text-xl font-bold tracking-wide text-emerald-800">{s.codigo}</p><h3 className="mt-1 text-lg font-bold text-slate-800">{s.documento}</h3><p className="mt-1 text-xs text-slate-500">Solicitado el {fechaDocumento(s.creadaEn)}</p></div><DocumentoEstado estado={s.estado} /></div><DocumentoDetalle solicitud={s} /><div className="flex flex-wrap gap-3"><button className="btn-secondary" onClick={() => { setImprimir(s); setTimeout(() => window.print(), 100); }}>Imprimir ficha</button>{s.estado === "SOLICITADA" && <button className="btn-secondary" disabled={busy || !!loadError} onClick={() => setCancelar(s)}>Cancelar solicitud</button>}</div></article>)}
      </section>
    </>}
    <ConfirmDialog open={!!cancelar} title="Cancelar solicitud de documento" message={`Se cancelará la ficha ${cancelar?.codigo ?? ""}. Podrás volver a solicitar si el periodo y los cupos lo permiten.`} confirmLabel="Cancelar solicitud" loading={busy} onCancel={() => setCancelar(null)} onConfirm={() => void cancelarSolicitud()} />
    {imprimir && createPortal(<div className="document-ticket-print"><h1>SGIAC · Ficha de recojo</h1><h2>{imprimir.codigo}</h2><p>{imprimir.documento} · {imprimir.solicitante} · RU {imprimir.ru}</p><p>Estado: <DocumentoEstado estado={imprimir.estado} /></p><DocumentoDetalle solicitud={imprimir} historial={false} /><p>Ficha emitida el {fechaDocumento(new Date().toISOString())}. Consulta el estado actualizado antes de acudir.</p></div>, document.body)}
  </div>;
}

