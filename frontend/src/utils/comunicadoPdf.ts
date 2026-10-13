import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import type { Comunicado } from "../api/types";
import { formatFecha } from "./formatters";
import { fragmentosNegrita } from "./comunicadoTexto";

// Este módulo y las fuentes se cargan únicamente al pulsar Descargar.
pdfMake.addVirtualFileSystem(pdfFonts);

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

export async function descargarComunicadoPdf(comunicado: Comunicado): Promise<void> {
  const [kardex, carrera] = await Promise.all([
    cargarImagen("/images/kardex.png"),
    cargarImagen("/images/informatica-umsa.png"),
  ]);
  const azul = "#20395e";
  const rojo = "#843447";
  const parrafos: Content[] = comunicado.contenido.replace(/\r\n?/g, "\n").trim().split(/\n\s*\n/).filter(Boolean).map(parrafo => ({
    text: fragmentosNegrita(parrafo),
    margin: [0, 0, 0, 12],
  }));

  const documento: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [46, 140, 46, 112],
    info: { title: comunicado.titulo, author: "Kardex · Carrera de Informática", subject: "Comunicado institucional" },
    defaultStyle: { font: "Roboto", fontSize: 11, color: "#24334b", lineHeight: 1.5 },
    images: { kardex, carrera },
    header: (_pagina, _total, tamano) => ({
      margin: [38, 30, 38, 0],
      stack: [
        {
          columns: [
            { image: "kardex", width: 64 },
            {
              width: "*", alignment: "center", margin: [10, 3, 10, 0], color: azul, lineHeight: 1.1,
              stack: [
                { text: "UNIVERSIDAD MAYOR DE SAN ANDRÉS", bold: true, fontSize: 11 },
                { text: "FACULTAD DE CIENCIAS PURAS Y NATURALES", fontSize: 7, margin: [0, 4, 0, 0] },
                { text: "CARRERA DE INFORMÁTICA", bold: true, fontSize: 9, margin: [0, 4, 0, 0] },
                { text: "La Paz · Bolivia", fontSize: 7, color: "#64748b", margin: [0, 5, 0, 0] },
              ],
            },
            { image: "carrera", width: 64 },
          ],
        },
        { canvas: [{ type: "line", x1: 0, y1: 0, x2: tamano.width - 76, y2: 0, lineWidth: 1.2, lineColor: azul }], margin: [0, 16, 0, 0] },
      ],
    }),
    background: (_pagina, tamano) => ({
      image: "carrera", width: 280, opacity: .045,
      absolutePosition: { x: (tamano.width - 280) / 2, y: (tamano.height - 280) / 2 },
    }),
    footer: (pagina, total, tamano) => ({
      stack: [
        {
          table: {
            widths: ["*"], heights: [84],
            body: [[{
              text: pagina === total ? [
                { text: "KARDEX\n", color: azul, bold: true, fontSize: 10, characterSpacing: 1.5 },
                { text: "Carrera de Informática", color: "#64748b", fontSize: 8 },
              ] : "",
              alignment: "center", margin: [0, 25, 0, 0], lineHeight: 1.2,
            }]],
          },
          layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
        },
        { canvas: [{ type: "rect", x: 0, y: 0, w: tamano.width, h: 28, linearGradient: [azul, rojo], lineWidth: 0 }] },
        {
          columns: [
            { width: (tamano.width - 92) / 2, text: "CARRERA DE INFORMÁTICA", bold: true },
            { width: (tamano.width - 92) / 2, text: `UMSA · LA PAZ, BOLIVIA   |   ${pagina} / ${total}`, alignment: "right" },
          ],
          margin: [46, -19, 46, 0], color: "#ffffff", fontSize: 6.5, lineHeight: 1,
        },
      ],
    }),
    content: [
      {
        columns: [
          { width: "*", text: comunicado.categoria, bold: true },
          { width: "auto", text: `La Paz, ${formatFecha(comunicado.fechaPublicacion)}`, alignment: "right" },
        ],
        columnGap: 16, fontSize: 8, color: "#64748b", margin: [0, 0, 0, 28],
      },
      {
        unbreakable: true, alignment: "center",
        stack: [
          { text: "COMUNICADO", color: rojo, bold: true, fontSize: 9, characterSpacing: 2 },
          { text: comunicado.titulo, color: azul, bold: true, fontSize: 22, lineHeight: 1.2, margin: [0, 10, 0, 10] },
        ],
        margin: [0, 0, 0, 20],
      },
      ...parrafos,
    ],
  };
  const nombre = comunicado.titulo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  await pdfMake.createPdf(documento).download(`comunicado-${nombre || comunicado.idComunicado}.pdf`);
}
