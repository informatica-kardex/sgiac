export function fragmentosNegrita(texto: string): { text: string; bold: boolean }[] {
  return texto.split(/(\*\*[^*\n]+\*\*)/g).map(fragmento => {
    const bold = fragmento.startsWith("**") && fragmento.endsWith("**") && fragmento.length > 4;
    return { text: bold ? fragmento.slice(2, -2) : fragmento, bold };
  });
}
