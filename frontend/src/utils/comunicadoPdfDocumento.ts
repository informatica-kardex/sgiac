import pdfMake from "pdfmake/build/pdfmake";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import type { ComunicadoTexto } from "./comunicadoPdf";
import { formatFecha } from "./formatters";
import { bloquesTexto, fragmentosFormato } from "./comunicadoTexto";

// Las fuentes se cargan al descargar o preparar una vista previa.
pdfMake.addFonts({
  TimesNewRoman: {
    normal: new URL("/fonts/times-new-roman.ttf", globalThis.location.origin).href,
    bold: new URL("/fonts/times-new-roman-bold.ttf", globalThis.location.origin).href,
    italics: new URL("/fonts/times-new-roman-italic.ttf", globalThis.location.origin).href,
    bolditalics: new URL("/fonts/times-new-roman-bold-italic.ttf", globalThis.location.origin).href,
  },
});

async function cargarImagen(url: string): Promise<string> {
  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error("No se pudo cargar el membrete");
  const blob = await respuesta.blob();
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result));
    lector.onerror = () => reject(new Error("No se pudo leer el membrete"));
    lector.readAsDataURL(blob);
  });
}

export async function crearComunicadoPdf(comunicado: ComunicadoTexto) {
  const [kardex, carrera] = await Promise.all([
    cargarImagen("/images/kardex.png"),
    cargarImagen("/images/informatica-umsa.png"),
  ]);
  const azul = "#20395e";
  const rojo = "#843447";
  const ancho = 595.28;
  const margen = 38;
  const anchoContenido = ancho - margen * 2;
  const contenido = comunicado.mayusculas === false ? comunicado.contenido : comunicado.contenido.toLocaleUpperCase("es-BO");
  const fontSize = comunicado.tamanoLetra ?? 13;
  const parrafos: Content[] = bloquesTexto(contenido).map(bloque => {
    if (bloque.tipo === "parrafo") return { text: fragmentosFormato(bloque.texto || " "), fontSize, margin: [0, 0, 0, 10] };
    const items = bloque.items.map(texto => ({ text: fragmentosFormato(texto), margin: [0, 0, 0, 4] as [number, number, number, number] }));
    return bloque.ordenada ? { ol: items, fontSize, start: bloque.inicio, margin: [12, 0, 0, 10] } : { ul: items, fontSize, margin: [12, 0, 0, 10] };
  });

  const documento: TDocumentDefinitions = {
    // El membrete, el texto y el cierre fluyen juntos: la hoja crece con su contenido.
    pageSize: { width: ancho, height: "auto" },
    pageMargins: [margen, 24, margen, 0],
    info: { title: comunicado.titulo.toLocaleUpperCase("es-BO"), author: "KARDEX · CARRERA DE INFORMÁTICA", subject: "COMUNICADO INSTITUCIONAL" },
    defaultStyle: { font: "TimesNewRoman", fontSize: 13, color: "#24334b", lineHeight: 1.35 },
    images: { kardex, carrera },
    background: {
      image: "carrera", width: 180, opacity: .045,
      absolutePosition: { x: (ancho - 180) / 2, y: 155 },
    },
    content: [
      {
        columns: [
          { image: "kardex", width: 64 },
          {
            width: "*", alignment: "center", margin: [10, 3, 10, 0], color: azul, lineHeight: 1.1,
            stack: [
              { text: "UNIVERSIDAD MAYOR DE SAN ANDRÉS", bold: true },
              { text: "FACULTAD DE CIENCIAS PURAS Y NATURALES", margin: [0, 4, 0, 0] },
              { text: "CARRERA DE INFORMÁTICA", bold: true, margin: [0, 4, 0, 0] },
              { text: "LA PAZ · BOLIVIA", color: "#64748b", margin: [0, 4, 0, 0] },
            ],
          },
          { image: "carrera", width: 64 },
        ],
      },
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: anchoContenido, y2: 0, lineWidth: 1.2, lineColor: azul }], margin: [0, 14, 0, 16] },
      {
        columns: [
          { width: "*", text: comunicado.categoria.toLocaleUpperCase("es-BO"), bold: true },
          { width: "auto", text: `LA PAZ, ${formatFecha(comunicado.fechaPublicacion).toLocaleUpperCase("es-BO")}`, alignment: "right" },
        ],
        columnGap: 16, color: "#64748b", margin: [0, 0, 0, 18],
      },
      {
        unbreakable: true, alignment: "center",
        stack: [
          { text: (comunicado.encabezado?.trim() || "COMUNICADO").toLocaleUpperCase("es-BO"), color: rojo, bold: true, fontSize: 28, lineHeight: 1.15, characterSpacing: 1.2 },
          { text: comunicado.titulo.toLocaleUpperCase("es-BO"), color: azul, bold: true, margin: [0, 8, 0, 0] },
        ],
        margin: [0, 0, 0, 16],
      },
      ...parrafos,
      {
        alignment: "center", margin: [0, 42, 0, 18],
        stack: [
          { text: "KARDEX", color: azul, bold: true, characterSpacing: 1.5 },
          { text: "CARRERA DE INFORMÁTICA", color: "#64748b" },
        ],
      },
      { canvas: [{ type: "rect", x: 0, y: 0, w: ancho, h: 32, linearGradient: [azul, rojo], lineWidth: 0 }], margin: [-margen, 0, -margen, 0] },
      {
        columns: [
          { width: "*", text: "CARRERA DE INFORMÁTICA", bold: true },
          { width: "*", text: "UMSA · LA PAZ, BOLIVIA", alignment: "right" },
        ],
        margin: [0, -25, 0, 0], color: "#ffffff", lineHeight: 1,
      },
    ],
  };
  return pdfMake.createPdf(documento);
}

