import type { Comunicado } from "../api/types";

export type ComunicadoTexto = Pick<Comunicado, "titulo" | "encabezado" | "contenido" | "categoria" | "fechaPublicacion" | "mayusculas" | "tamanoLetra">;

// El cálculo de la hoja y las fuentes no bloquea el hilo que atiende el teclado.
// Si el texto cambia, se termina también el trabajo de la vista previa anterior.
export function crearComunicadoPdfBuffer(comunicado: ComunicadoTexto, signal?: AbortSignal): Promise<ArrayBuffer> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./comunicadoPdf.worker.ts", import.meta.url), { type: "module" });
    const terminar = () => { signal?.removeEventListener("abort", cancelar); worker.terminate(); };
    const cancelar = () => { terminar(); reject(signal?.reason ?? new DOMException("Cancelado", "AbortError")); };
    worker.onmessage = ({ data }: MessageEvent<{ buffer?: ArrayBuffer; error?: string }>) => {
      terminar();
      if (data.buffer) resolve(data.buffer);
      else reject(new Error(data.error || "No se pudo generar el comunicado"));
    };
    worker.onerror = () => { terminar(); reject(new Error("No se pudo generar el comunicado")); };
    signal?.addEventListener("abort", cancelar, { once: true });
    worker.postMessage(comunicado);
  });
}

export async function descargarComunicadoPdf(comunicado: Comunicado): Promise<void> {
  const buffer = await crearComunicadoPdfBuffer(comunicado);
  const nombre = comunicado.titulo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/pdf" }));
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `comunicado-${nombre || comunicado.idComunicado}.pdf`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
