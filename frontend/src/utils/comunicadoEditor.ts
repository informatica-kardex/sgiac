import type { JSONContent } from "@tiptap/react";
import { bloquesTexto, fragmentosFormato } from "./comunicadoTexto";

// El editor y los documentos comparten el mismo formato de texto guardado.
export function documentoEditor(contenido: string): JSONContent {
  const parrafo = (texto: string): JSONContent => ({
    type: "paragraph",
    content: texto.split("\n").flatMap((linea, index) => [
      ...(index ? [{ type: "hardBreak" }] : []),
      ...fragmentosFormato(linea).map(({ text, bold, italics }) => ({
        type: "text", text,
        marks: [...(bold ? [{ type: "bold" }] : []), ...(italics ? [{ type: "italic" }] : [])],
      })),
    ]),
  });
  const content = bloquesTexto(contenido).map(bloque => bloque.tipo === "parrafo" ? parrafo(bloque.texto) : {
    type: bloque.ordenada ? "orderedList" : "bulletList",
    ...(bloque.ordenada ? { attrs: { start: bloque.inicio } } : {}),
    content: bloque.items.map(texto => ({ type: "listItem", content: [parrafo(texto)] })),
  });
  return { type: "doc", content: content.length ? content : [parrafo("")] };
}

function textoParrafo(nodo: JSONContent): string {
  let resultado = "", negrita = false, cursiva = false;
  const cambiar = (bold: boolean, italic: boolean) => {
    if (cursiva && (!italic || bold !== negrita)) { resultado += "_"; cursiva = false; }
    if (bold !== negrita) { resultado += "**"; negrita = bold; }
    if (italic && !cursiva) { resultado += "_"; cursiva = true; }
  };
  for (const hijo of nodo.content ?? []) {
    if (hijo.type === "hardBreak") { cambiar(false, false); resultado += "\n"; continue; }
    cambiar(!!hijo.marks?.some(m => m.type === "bold"), !!hijo.marks?.some(m => m.type === "italic"));
    resultado += (hijo.text ?? "").replace(/[\\*_]/g, "\\$&");
  }
  cambiar(false, false);
  // Un guion o número escrito como texto no se convierte en una lista al reabrirlo.
  return resultado.replace(/^(\s*)([-+•]|\d+[.)])(?=\s)/gm, "$1\\$2");
}

export function textoEditor(documento: JSONContent): string {
  return (documento.content ?? []).map(nodo => {
    if (nodo.type === "paragraph") return textoParrafo(nodo);
    const inicio = Number(nodo.attrs?.start) || 1;
    return (nodo.content ?? []).map((item, index) => {
      const texto = (item.content ?? []).map(textoParrafo).join("\n").replace(/\n/g, "\n  ");
      return `${nodo.type === "orderedList" ? `${inicio + index}.` : "-"} ${texto}`;
    }).join("\n");
  }).join("\n\n");
}
