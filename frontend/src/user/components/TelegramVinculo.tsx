import { useCallback, useRef, useState } from "react";
import { axiosClient } from "../../api/axiosClient";
import { ApiEnvelope } from "../../api/types";
import { mensajeError, usePolling } from "../../hooks/usePolling";
import { fechaDocumento } from "../../components/DocumentoDetalle";
import { ConfirmDialog } from "../../admin/components/ConfirmDialog";

interface EstadoVinculo { vinculado: boolean; vinculadoEn: string | null; available: boolean; url: string | null }
export function TelegramVinculo() {
  const load = useCallback(async () => (await axiosClient.get<ApiEnvelope<EstadoVinculo>>("/telegram/vinculo")).data.data, []);
  const { data, loading, error: loadError, refresh } = usePolling(load, 15000);
  const [consentimiento, setConsentimiento] = useState(false);
  const [enlace, setEnlace] = useState<{ url: string; expiraEn: string } | null>(null);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [confirmar, setConfirmar] = useState(false);
  async function cambiar(vincular: boolean) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setMensaje("");
    try {
      if (vincular) {
        const response = await axiosClient.post<ApiEnvelope<{ url: string; expiraEn: string }>>("/telegram/vinculo", { consentimiento });
        if (!/^https:\/\/t\.me\/[A-Za-z0-9_]+\?start=sgiac_[A-Za-z0-9_-]{43}$/.test(response.data.data.url)) throw new Error("Enlace inválido");
        setEnlace(response.data.data);
      } else {
        await axiosClient.delete("/telegram/vinculo"); setEnlace(null); setConsentimiento(false); setMensaje("Vinculación y enlaces pendientes cancelados. Puedes seguir usando el bot público.");
      }
    } catch (e) { setError(mensajeError(e)); }
    finally { lock.current = false; setBusy(false); setConfirmar(false); refresh(); }
  }
  const enlaceVigente = enlace && Date.parse(enlace.expiraEn) > Date.now();
  return <section className="card space-y-4 p-6" aria-label="Avisos voluntarios por Telegram">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-800">Tus avisos también en Telegram</h2><p className="mt-2 text-sm leading-6 text-slate-500">El bot público responde preguntas sin vinculación. Si lo deseas, vincula tu cuenta para recibir avisos personales cuando tus documentos estén listos.</p></div>{data?.vinculado && <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">Vinculado</span>}</div>
    {(error || loadError) && <p role="alert" className="text-sm text-red-700">{error || loadError} <button onClick={refresh} className="underline">Reintentar</button></p>}
    {mensaje && <p role="status" className="text-sm text-emerald-800">{mensaje}</p>}
    {loading ? <p className="text-sm text-slate-500">Consultando vinculación…</p> : data?.vinculado ? <><p className="text-sm text-emerald-900">Vinculado el {fechaDocumento(data.vinculadoEn)}. Usa <strong>/misdocumentos</strong> en el bot para consultar tus solicitudes. Puedes dejar de recibir avisos aquí o con <strong>/desvincular</strong>.</p>{!data.available && <p className="text-sm text-amber-800">El bot está temporalmente desconectado. El seguimiento sigue disponible en tu sesión.</p>}<button className="btn-secondary" disabled={busy || !!loadError} onClick={() => setConfirmar(true)}>Desvincular Telegram</button></> : data && <>
      <label className="flex items-start gap-3 text-sm text-slate-700"><input type="checkbox" className="mt-1" checked={consentimiento} disabled={busy} onChange={e => setConsentimiento(e.target.checked)} />Quiero vincular mi Telegram para recibir avisos de recojo y consultar mis solicitudes. Puedo desvincularlo cuando quiera.</label>
      {!data.available && <p className="text-sm text-slate-500">El bot no está disponible para nuevas vinculaciones en este momento. Puedes continuar usando todos los trámites desde tu sesión.</p>}
      {enlaceVigente && !data.vinculado ? <div className="rounded-xl bg-sky-50 p-4 text-sm text-sky-950"><p>Abre el enlace y pulsa <strong>Iniciar</strong> en el bot para confirmar. Es personal, de un solo uso y vence el {fechaDocumento(enlace.expiraEn)}. No lo compartas.</p><div className="mt-3 flex flex-wrap gap-3"><a className="btn-primary" href={enlace.url} target="_blank" rel="noopener noreferrer">Abrir Telegram para confirmar ↗</a><button className="btn-secondary" onClick={refresh}>Ya lo vinculé: actualizar</button><button className="btn-secondary" disabled={busy} onClick={() => void cambiar(false)}>Cancelar enlace</button></div></div> : <button className="btn-primary" disabled={busy || !consentimiento || !data.available || !!loadError} onClick={() => void cambiar(true)}>{busy ? "Generando enlace…" : enlace ? "Generar nuevo enlace" : "Vincular mi Telegram"}</button>}
    </>}
    <ConfirmDialog open={confirmar} title="Desvincular Telegram" message="Dejarás de recibir avisos personales en Telegram. Tus solicitudes y los avisos dentro de tu sesión seguirán disponibles." confirmLabel="Desvincular" loading={busy} onCancel={() => setConfirmar(false)} onConfirm={() => void cambiar(false)} />
  </section>;
}
