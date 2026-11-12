import { useEffect, useState } from "react";
import type { ComunicadoTexto } from "../utils/comunicadoPdf";

export function ComunicadoTextoPreview({ titulo, encabezado, contenido, categoria, fechaPublicacion, mayusculas, tamanoLetra }: ComunicadoTexto) {
  const [imagen, setImagen] = useState<{ url: string; clave: string } | null>(null);
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);
  const clave = JSON.stringify([titulo, encabezado, contenido, categoria, fechaPublicacion, mayusculas, tamanoLetra]);
  const actualizando = imagen?.clave !== clave;

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    const timer = window.setTimeout(async () => {
      try {
        const { crearComunicadoImagen } = await import("../utils/comunicadoImagen");
        controller.signal.throwIfAborted();
        const blob = await crearComunicadoImagen({
          titulo: titulo.trim() || "Título del comunicado",
          encabezado,
          contenido: contenido.trim() || "Escribe el texto del comunicado para ver cómo quedará aquí.",
          categoria: categoria.trim() || "Categoría",
          fechaPublicacion,
          mayusculas, tamanoLetra,
        }, controller.signal);
        if (!controller.signal.aborted) setImagen({ url: URL.createObjectURL(blob), clave });
      } catch {
        if (!controller.signal.aborted) setError("No se pudo generar la vista previa. Inténtalo de nuevo.");
      }
    }, 650);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [titulo, encabezado, contenido, categoria, fechaPublicacion, mayusculas, tamanoLetra, clave, intento]);

  useEffect(() => () => { if (imagen) URL.revokeObjectURL(imagen.url); }, [imagen]);

  function descargar() {
    if (!imagen || actualizando || error || !titulo.trim() || !contenido.trim()) return;
    const nombre = titulo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
    const enlace = document.createElement("a");
    enlace.href = imagen.url;
    enlace.download = `comunicado-${nombre || "texto"}.png`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-700">Vista previa</p>
      <div className="max-h-[32rem] overflow-y-auto rounded border border-slate-200 bg-slate-50 p-2" aria-busy={actualizando && !error}>
        {imagen ? <img src={imagen.url} alt={`Vista previa del comunicado: ${titulo || "sin título"}`} className={`h-auto w-full ${actualizando ? "opacity-50" : ""}`} />
          : <div className="flex min-h-32 items-center justify-center bg-white p-4 text-center text-xs text-slate-500">La vista previa aparecerá aquí.</div>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={descargar} disabled={actualizando || !!error || !titulo.trim() || !contenido.trim()}
          className="inline-flex items-center gap-1.5 rounded border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" /></svg>
          Descargar imagen
        </button>
        <span role="status" className="text-xs text-slate-500">{error ? "" : actualizando ? "Actualizando vista previa…" : "PNG"}</span>
      </div>
      {error && <p role="alert" className="text-xs text-red-700">{error} <button type="button" className="font-semibold underline" onClick={() => setIntento(value => value + 1)}>Reintentar</button></p>}
    </div>
  );
}
