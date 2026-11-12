import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { crearComunicadoPdfBuffer, type ComunicadoTexto } from "./comunicadoPdf";

export async function crearComunicadoImagen(comunicado: ComunicadoTexto, signal: AbortSignal): Promise<Blob> {
  signal.throwIfAborted();
  const buffer = await crearComunicadoPdfBuffer(comunicado, signal);
  signal.throwIfAborted();
  GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const tarea = getDocument({ data: new Uint8Array(buffer) });
  const cancelar = () => { void tarea.destroy().catch(() => {}); };
  signal.addEventListener("abort", cancelar, { once: true });
  const canvas = document.createElement("canvas");
  const hoja = document.createElement("canvas");

  try {
    const documento = await tarea.promise;
    const primera = await documento.getPage(1);
    const original = primera.getViewport({ scale: 1 });
    // Se respeta la altura del documento y se incluye todo su contenido en la imagen.
    // Se limita el tamaño del lienzo para mantenerlo utilizable también en móviles.
    const escala = Math.min(2, 16000 / (original.height * documento.numPages),
      Math.sqrt(16000000 / (original.width * original.height * documento.numPages)));
    const viewport = primera.getViewport({ scale: escala });
    hoja.width = Math.ceil(viewport.width);
    hoja.height = Math.ceil(viewport.height);
    canvas.width = hoja.width;
    canvas.height = hoja.height * documento.numPages;
    const contexto = canvas.getContext("2d");
    if (!contexto) throw new Error("No se pudo crear la imagen del comunicado");

    for (let numero = 1; numero <= documento.numPages; numero++) {
      signal.throwIfAborted();
      const pagina = numero === 1 ? primera : await documento.getPage(numero);
      await pagina.render({ canvas: hoja, viewport }).promise;
      contexto.drawImage(hoja, 0, (numero - 1) * hoja.height);
      pagina.cleanup();
    }
    signal.throwIfAborted();
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("No se pudo generar el PNG")), "image/png");
    });
  } finally {
    signal.removeEventListener("abort", cancelar);
    canvas.width = canvas.height = hoja.width = hoja.height = 0;
    await tarea.destroy();
  }
}
