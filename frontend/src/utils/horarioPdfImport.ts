import { parseSchedulePages, type PdfPage } from '../admin/schedule/pdf-import';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export async function readSchedulePdf(file: File, progress: (message: string) => void) {
  if (!/\.pdf$/i.test(file.name)) throw new Error('Selecciona un archivo PDF.');
  if (!file.size || file.size > 20 * 1024 * 1024) throw new Error('El PDF debe pesar entre 1 byte y 20 MB.');
  const data = new Uint8Array(await file.arrayBuffer());
  if (!new TextDecoder().decode(data.slice(0, 1024)).includes('%PDF-')) throw new Error('El archivo no contiene un PDF válido.');
  const { getDocument, GlobalWorkerOptions, Util } = await import('pdfjs-dist');
  GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const task = getDocument({ data, useSystemFonts: true });
  try {
    const doc = await task.promise;
    if (doc.numPages > 100) throw new Error('El PDF admite hasta 100 páginas. Divide el documento e importa cada parte.');
    const pages: PdfPage[] = [];
    let count = 0;
    for (let n = 1; n <= doc.numPages; n++) {
      progress(`Leyendo página ${n} de ${doc.numPages}…`);
      const page = await doc.getPage(n), viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items = content.items.flatMap(item => {
        if (!('str' in item) || !item.str.trim()) return [];
        const transform = Util.transform(viewport.transform, item.transform);
        return [{ text: item.str, x: transform[4], y: transform[5], width: item.width }];
      });
      count += items.length;
      if (count > 100000) throw new Error('El PDF tiene demasiado contenido. Divide el documento antes de importarlo.');
      pages.push({ items });
      page.cleanup();
    }
    if (!count) throw new Error('Este PDF contiene imágenes sin texto seleccionable. Exporta el horario como PDF con texto para poder leerlo con precisión.');
    const result = parseSchedulePages(pages);
    if (!result.grupos.length) throw new Error('No se reconoció el formato de horarios. Usa un PDF con las columnas Paralelo, Docente y Horario, como el archivo de referencia.');
    return result;
  } catch (e) {
    if (e instanceof Error && e.name === 'PasswordException') throw new Error('El PDF está protegido con contraseña. Sube una copia sin protección.');
    throw e;
  } finally { await task.destroy(); }
}
