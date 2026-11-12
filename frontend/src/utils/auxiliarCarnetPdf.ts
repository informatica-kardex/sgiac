import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import type { CarnetAuxiliar } from '../api/auxiliar-carnet.api';

async function cargarLogo(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('No se pudieron cargar los logos del carnet.');
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer el logo del carnet.'));
    reader.readAsDataURL(blob);
  });
}

// Dos caras de 85,6 × 54 mm. El horario se consulta en línea para no imprimir
// una asignación que podría cambiar después de entregar el carnet.
export async function crearCarnetPdf(carnet: CarnetAuxiliar, enlace: string): Promise<Blob> {
  const [{ default: pdfMake }, { default: pdfFonts }, kardex, carrera] = await Promise.all([
    import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts'),
    cargarLogo('/images/kardex.png'), cargarLogo('/images/informatica-umsa.png'),
  ]);
  pdfMake.addVirtualFileSystem(pdfFonts);
  const mm = 72 / 25.4;
  const materias = carnet.materias ?? [];
  const compacto = carnet.nombreCompleto.length > 80 || carnet.correo.length > 65;
  const maxMaterias = compacto ? 2 : 3, maxNombreMateria = compacto ? 40 : 70;
  // La identificación mantiene el tamaño de una tarjeta incluso con muchas materias.
  const resumen = materias.slice(0, maxMaterias).map(m => m.length > maxNombreMateria ? `${m.slice(0, maxNombreMateria - 3)}…` : m).join(' · ');
  const textoMaterias = materias.length ? `${resumen}${materias.length > maxMaterias ? ` · +${materias.length - maxMaterias} materias` : ''}` : 'Sin materias vigentes';
  const documento: TDocumentDefinitions = {
    pageSize: { width: 85.6 * mm, height: 54 * mm }, pageMargins: [12, 8, 12, 12],
    info: { title: `Carnet de auxiliar · ${carnet.nombreCompleto}`, author: 'Carrera de Informática · UMSA' },
    defaultStyle: { font: 'Roboto', color: '#163d35', fontSize: 8 },
    images: { kardex, carrera },
    footer: (pagina: number) => ({ text: pagina === 1 ? `SGIAC · AUX-${carnet.idAuxiliar.padStart(6, '0')}` : 'Consulta pública · Horarios de Bolivia', alignment: 'center', fontSize: 6, color: '#52635e', margin: [6, 3, 6, 0] }),
    content: [
      {
        columns: [
          { image: 'kardex', width: compacto ? 28 : 36, fit: compacto ? [28, 28] : [36, 36] },
          { width: '*', alignment: 'center', margin: [0, compacto ? 1 : 3, 0, 0], stack: [
            { text: 'UNIVERSIDAD MAYOR DE SAN ANDRÉS', fontSize: compacto ? 5 : 5.2 },
            { text: 'CARRERA DE INFORMÁTICA', fontSize: compacto ? 7 : 7.5, bold: true, margin: [0, compacto ? 2 : 3, 0, 0] },
            { text: 'AUXILIAR DE DOCENCIA', fontSize: compacto ? 6 : 6.5, bold: true, color: '#047857', margin: [0, compacto ? 3 : 5, 0, 0] },
          ] },
          { image: 'carrera', width: compacto ? 28 : 36, fit: compacto ? [28, 28] : [36, 36] },
        ],
        columnGap: 6, margin: [0, 0, 0, 3],
      },
      {
        text: carnet.nombreCompleto, alignment: 'center', bold: true,
        fontSize: carnet.nombreCompleto.length > 160 ? 4.5 : carnet.nombreCompleto.length > 80 ? 6 : carnet.nombreCompleto.length > 45 ? 9 : 12,
        margin: [0, compacto ? 2 : 4, 0, compacto ? 3 : 4],
      },
      { text: `Registro universitario: ${carnet.ru || 'Sin registrar'}`, alignment: 'center', fontSize: carnet.ru.length > 18 ? 6.5 : 7.5, margin: [0, 0, 0, 3] },
      { text: carnet.correo, alignment: 'center', fontSize: carnet.correo.length > 65 ? 5 : 7, color: '#52635e' },
      { text: materias.length === 1 ? 'MATERIA' : 'MATERIAS', alignment: 'center', fontSize: 5.5, color: '#047857', bold: true, margin: [0, 5, 0, 2] },
      { text: textoMaterias, alignment: 'center', fontSize: compacto || textoMaterias.length > 110 ? 5.5 : 7, bold: true },
      { text: 'ESCANEA PARA VER TU AULA Y HORARIO', pageBreak: 'before', bold: true, fontSize: 7, alignment: 'center', margin: [0, 0, 0, 5] },
      // El espacio blanco alrededor del QR queda libre (zona de silencio).
      { qr: enlace, fit: 92, padding: 4, eccLevel: 'M', alignment: 'center', foreground: '#000000', background: '#ffffff' },
      { text: 'Abre el enlace con la cámara de tu celular.', fontSize: 6, alignment: 'center', margin: [0, 5, 0, 0] },
    ],
  };
  return pdfMake.createPdf(documento).getBlob();
}
