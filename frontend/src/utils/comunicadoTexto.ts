export type FragmentoTexto = { text: string; bold: boolean; italics: boolean };

const escapado = (texto: string, posicion: number) => {
  let barras = 0;
  while (posicion > 0 && texto[--posicion] === "\\") barras++;
  return barras % 2 === 1;
};
const desescapar = (texto: string) => texto.replace(/\\([\\*_+•.()\d-])/g, "$1");

// Sin interpretar HTML. Conserva el formato antiguo y los caracteres literales del editor.
export function fragmentosFormato(texto: string, bold = false, italics = false): FragmentoTexto[] {
  const resultado: FragmentoTexto[] = [];
  const agregar = (text: string) => { if (text) resultado.push({ text: desescapar(text), bold, italics }); };
  const marcas = /\*+|_/g;
  let inicio = 0;
  let coincidencia: RegExpExecArray | null;
  while ((coincidencia = marcas.exec(texto))) {
    const marca = coincidencia[0];
    if (marca.length > 3 || escapado(texto, coincidencia.index)) continue;
    const desde = coincidencia.index + marca.length;
    let hasta = texto.indexOf(marca, desde);
    while (hasta !== -1) {
      if (escapado(texto, hasta)) { hasta = texto.indexOf(marca, hasta + marca.length); continue; }
      if (marca === "_") break;
      const cantidad = texto.slice(hasta).match(/^\*+/)![0].length;
      if (cantidad > 3 || (marca.length === 1 && cantidad === 2)) {
        hasta = texto.indexOf(marca, hasta + cantidad);
        continue;
      }
      hasta += cantidad - marca.length;
      break;
    }
    if (hasta === -1 || hasta === desde || texto.slice(desde, hasta).includes("\n")) continue;
    agregar(texto.slice(inicio, coincidencia.index));
    resultado.push(...fragmentosFormato(texto.slice(desde, hasta), bold || marca.length >= 2, italics || marca.length !== 2));
    inicio = hasta + marca.length;
    marcas.lastIndex = inicio;
  }
  agregar(texto.slice(inicio));
  return resultado;
}

export type BloqueTexto = { tipo: "parrafo"; texto: string }
  | { tipo: "lista"; ordenada: boolean; inicio: number; items: string[] };

export function bloquesTexto(contenido: string): BloqueTexto[] {
  const bloques: BloqueTexto[] = [];
  let actual: BloqueTexto | undefined;
  if (!contenido.trim()) return bloques;
  let vacias = 0;
  const agregarEspacios = () => {
    for (let i = 0; i < Math.floor(vacias / 2); i++) bloques.push({ tipo: "parrafo", texto: "" });
    vacias = 0;
  };
  for (const linea of contenido.replace(/\r\n?/g, "\n").split("\n")) {
    const item = linea.match(/^\s*(?:[-+*•]|([1-9]\d{0,5})[.)])\s+(.*)$/);
    if (!item && actual?.tipo === "lista" && linea.startsWith("  ")) {
      actual.items[actual.items.length - 1] += `\n${linea.slice(2)}`;
      continue;
    }
    if (!linea.trim()) { actual = undefined; vacias++; continue; }
    agregarEspacios();
    if (item) {
      const ordenada = !!item[1];
      if (actual?.tipo !== "lista" || actual.ordenada !== ordenada) {
        actual = { tipo: "lista", ordenada, inicio: Number(item[1]) || 1, items: [] };
        bloques.push(actual);
      }
      actual.items.push(item[2]);
    } else if (actual?.tipo === "parrafo") {
      actual.texto += `\n${linea}`;
    } else {
      actual = { tipo: "parrafo", texto: linea };
      bloques.push(actual);
    }
  }
  agregarEspacios();
  return bloques;
}
