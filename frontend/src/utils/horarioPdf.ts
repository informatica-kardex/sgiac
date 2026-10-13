import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';

const escapeXml = (value: string) => value.replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]!);
const number = (value: number) => Number(value.toFixed(3));

// Capture the already fitted print tables as vectors. This preserves the same
// wrapping, merged cells and colors without maintaining a second timetable.
export function capturarHorariosPdf(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll<HTMLTableElement>('.room-timetable'), table => {
    const bounds = table.getBoundingClientRect();
    const shapes: string[] = [];
    for (const element of table.querySelectorAll<HTMLElement>('caption, th, td, .room-session')) {
      const box = element.getBoundingClientRect(), style = getComputedStyle(element);
      const x = number(box.left - bounds.left), y = number(box.top - bounds.top);
      const fill = style.backgroundColor === 'rgba(0, 0, 0, 0)' ? 'none' : style.backgroundColor;
      const border = element.matches('caption, th, td');
      shapes.push(`<rect x="${x}" y="${y}" width="${number(box.width)}" height="${number(box.height)}" fill="${fill}"${border ? ' stroke="#b6b1a2" stroke-width="0.8"' : ''}/>`);
      if (element.matches('.room-session + .room-session')) shapes.push(`<path d="M${x} ${y}h${number(box.width)}" stroke="#aaa58f" stroke-width="0.8" stroke-dasharray="3 2"/>`);
    }

    const walker = document.createTreeWalker(table, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (!node.textContent?.trim() || !node.parentElement) continue;
      const style = getComputedStyle(node.parentElement), fontSize = parseFloat(style.fontSize);
      const range = document.createRange();
      let line = '', lineBox: DOMRect | null = null;
      const writeLine = () => {
        if (!lineBox || !line.trim() || lineBox.width === 0) return;
        const text = style.textTransform === 'uppercase' ? line.trim().toUpperCase() : line.trim();
        shapes.push(`<text x="${number(lineBox.left - bounds.left)}" y="${number(lineBox.bottom - bounds.top - fontSize * .2)}" font-family="Roboto" font-size="${number(fontSize)}" font-weight="${parseInt(style.fontWeight) >= 600 ? 'bold' : 'normal'}" fill="${style.color}" textLength="${number(lineBox.width)}" lengthAdjust="spacingAndGlyphs" xml:space="preserve">${escapeXml(text)}</text>`);
      };
      // Ranges retain the browser's line breaks, including very long names.
      for (let offset = 0; offset < node.textContent.length; offset++) {
        range.setStart(node, offset); range.setEnd(node, offset + 1);
        const box = range.getBoundingClientRect();
        if (!box.width) continue;
        if (lineBox && Math.abs(box.top - lineBox.top) > 1) { writeLine(); line = ''; lineBox = null; }
        const char = node.textContent[offset];
        if (!lineBox && !char.trim()) continue;
        line += char;
        // SVG renderers trim edge spaces; keep their gap in the coordinates
        // instead of stretching the neighboring word across that space.
        if (char.trim()) lineBox = lineBox ? new DOMRect(lineBox.left, lineBox.top, box.right - lineBox.left, lineBox.height) : box;
      }
      writeLine();
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${number(bounds.width)}" height="${number(bounds.height)}" viewBox="-0.5 -0.5 ${number(bounds.width + 1)} ${number(bounds.height + 1)}"><rect width="100%" height="100%" fill="white"/>${shapes.join('')}</svg>`;
  });
}

export async function crearHorariosPdf(horarios: string[], titulo: string): Promise<Blob> {
  if (!horarios.length) throw new Error('No hay horarios para generar el PDF.');
  const [{ default: pdfMake }, { default: pdfFonts }] = await Promise.all([
    import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts'),
  ]);
  pdfMake.addVirtualFileSystem(pdfFonts);
  const mm = 72 / 25.4;
  const content: Content[] = horarios.map((svg, index) => ({
    svg, fit: [195.9 * mm, 124 * mm],
    absolutePosition: { x: 10 * mm, y: (10 + (index % 2) * 131) * mm },
    ...(index > 0 && index % 2 === 0 ? { pageBreak: 'before' as const } : {}),
  }));
  const document: TDocumentDefinitions = {
    pageSize: 'LETTER', pageMargins: 10 * mm,
    info: { title: titulo, author: 'Carrera de Informática · UMSA' },
    content,
  };
  return pdfMake.createPdf(document).getBlob();
}
