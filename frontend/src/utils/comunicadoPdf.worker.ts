import { crearComunicadoPdf } from "./comunicadoPdfDocumento";
import type { ComunicadoTexto } from "./comunicadoPdf";

self.onmessage = async ({ data }: MessageEvent<ComunicadoTexto>) => {
  try {
    const pdf = await crearComunicadoPdf(data);
    const buffer = new Uint8Array(await pdf.getBuffer()).buffer;
    self.postMessage({ buffer }, { transfer: [buffer] });
  } catch {
    self.postMessage({ error: "No se pudo generar el comunicado" });
  }
};
