import { ChangeEvent, useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fichasApi } from "../../api/fichas.api";
import { mensajeError, usePolling } from "../../hooks/usePolling";

export function TVControl() {
  const load = useCallback(async () => (await fichasApi.tvConfig()).data.data, []);
  const { data, error: loadError, refresh } = usePolling(load, 15000);
  const [busy, setBusy] = useState(false);
  const bloqueo = useRef(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  async function accion(fn: () => Promise<unknown>, texto: string) {
    if (bloqueo.current) return;
    bloqueo.current = true; setBusy(true); setError(""); setMensaje("");
    try { await fn(); setMensaje(texto); }
    catch (e) { setError(mensajeError(e)); }
    finally { bloqueo.current = false; setBusy(false); refresh(); }
  }
  function subir(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []); e.target.value = "";
    if (!files.length) return;
    if (files.some(f => f.size > 100 * 1024 * 1024)) { setError("Cada archivo debe pesar como máximo 100 MB."); return; }
    if ((data?.archivos.length ?? 0) + files.length > 20) { setError("Puedes publicar hasta 20 archivos en la TV."); return; }
    void accion(async () => { for (const file of files) await fichasApi.tvSubir(file); }, "Archivos publicados. La TV los recibirá automáticamente.");
  }
  return <section className="space-y-5" aria-label="Configuración de televisión">
    <div className="card p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-slate-800">Presentación en TV</h2><p className="mt-2 text-sm text-slate-500">Controla el contenido y los anuncios de las pantallas desde aquí.</p></div><Link to="/atencion/pantalla" target="_blank" rel="noreferrer" className="btn-primary">Presentar en TV ↗</Link></div><p className="mt-4 text-sm text-slate-600">Abre la presentación, muévela al televisor y presiona <strong>F11</strong> en esa ventana. La pantalla recibe los cambios cada 5 segundos.</p></div>
    {(error || loadError) && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error || loadError}</p>}
    {mensaje && <p role="status" className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">{mensaje}</p>}
    {!data ? <p>Cargando configuración…</p> : <>
      <fieldset disabled={busy || !!loadError} className="card space-y-4 p-6"><legend className="sr-only">Voz y actualización de TV</legend><h3 className="font-bold text-slate-800">Voz y actualización</h3><div className="flex flex-wrap gap-3"><button className="btn-secondary" aria-pressed={data.voz} onClick={() => void accion(() => fichasApi.tvVoz(!data.voz), data.voz ? "Voz desactivada en las pantallas." : "Voz activada en las pantallas.")}>Voz: {data.voz ? "activada" : "desactivada"}</button><button className="btn-secondary" disabled={!data.voz} onClick={() => void accion(() => fichasApi.tvProbarVoz(), "Prueba de voz enviada a la TV.")}>Probar voz en TV</button><button className="btn-secondary" onClick={() => void accion(() => fichasApi.tvActualizar(), "Actualización enviada a las pantallas.")}>Actualizar TV</button></div><p className="text-xs leading-5 text-slate-500">Los videos se reproducen sin sonido. Si el navegador bloquea los anuncios, haz un clic en la ventana de la TV para habilitar el audio y luego pulsa «Probar voz en TV» aquí.</p></fieldset>
      <fieldset disabled={busy || !!loadError} className="card space-y-4 p-6"><legend className="sr-only">Archivos de TV</legend><h3 className="font-bold text-slate-800">Imágenes y videos</h3><p className="text-sm text-slate-500">Estos archivos se mostrarán públicamente en las pantallas. Se conservan al cerrar o recargar el navegador.</p><label className="block text-sm font-semibold text-slate-700">Agregar archivos<input className="mt-2 block max-w-full text-sm" type="file" multiple accept="image/png,image/jpeg,image/webp,video/mp4,video/webm" onChange={subir} /></label><p className="text-xs text-slate-500">Hasta 20 archivos · PNG, JPG, WebP, MP4 o WebM · Máximo 100 MB por archivo.</p>{busy && <p role="status" className="text-sm text-emerald-700">Procesando…</p>}
        <ul className="divide-y divide-slate-100">{data.archivos.map((a, i) => <li key={a.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="break-words font-medium text-slate-700">{i + 1}. {a.nombre}</p><span className="text-xs text-slate-500">{a.tipo === "video" ? "Video" : "Imagen"}</span></div><button className="btn-secondary shrink-0" onClick={() => void accion(() => fichasApi.tvEliminar(a.id), "Archivo retirado de las pantallas.")}>Retirar</button></li>)}</ul>{!data.archivos.length && <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Sin archivos propios: se muestran los comunicados públicos y consejos de Kardex.</p>}
      </fieldset>
    </>}
  </section>;
}
