import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { prisma } from '../src/database/prisma';
import { academicTransaction } from '../src/modules/academico/academico.shared';

type Catalogo = {
  fuente: string; sha256: string;
  materias: { nombre: string; siglas: string[]; paginas: number[] }[];
  aulas: { codigo: string; nombre: string; lugar: string; piso: number | null; tipo: string; paginas: number[] }[];
};
const catalogo: Catalogo = JSON.parse(readFileSync(join(__dirname, 'data/catalogo-pdf.json'), 'utf8'));
// El PDF original usa la numeración anterior; el catálogo del sistema usa la corregida.
const correcciones: Record<string, string> = JSON.parse(readFileSync(join(__dirname, 'data/aulas-kardex.json'), 'utf8')).codigosAnterioresHorarios;
catalogo.aulas = catalogo.aulas.map(a => correcciones[a.codigo] ? { ...a, codigo: correcciones[a.codigo], nombre: correcciones[a.codigo] } : a);
const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const huella = (data: unknown) => createHash('sha256').update(JSON.stringify(data, (_, v) => typeof v === 'bigint' ? String(v) : v)).digest('hex');

async function main() {
  const aplicar = process.argv.includes('--apply');
  const resultado = await academicTransaction(async tx => {
    const materias = await tx.materia.findMany({ include: { siglas: true } });
    const aulas = await tx.ambiente.findMany();
    if (aulas.some(a => a.codigo_ambiente === 'P3-LAB4')) throw Error('Ejecuta primero importar-aulas-kardex.ts para corregir la numeración de los laboratorios.');
    const anteriores = await Promise.all([tx.docente.findMany({ orderBy: { id_docente: 'asc' } }), tx.paralelo.findMany({ orderBy: { id_paralelo: 'asc' } }), tx.horario.findMany({ orderBy: { id_horario: 'asc' } })]);
    const nuevasMaterias: { codigo_materia: string; nombre: string }[] = [];
    const nuevasSiglas: { codigo_materia: string; sigla: string }[] = [];
    const claves = new Set(materias.map(m => m.codigo_materia));
    for (const m of catalogo.materias) {
      const coincidencias = materias.filter(actual => normalizar(actual.nombre) === normalizar(m.nombre));
      if (coincidencias.length > 1) throw new Error(`Revisar materias homónimas antes de importar: ${m.nombre}`);
      const anterior = coincidencias[0];
      let codigo = anterior?.codigo_materia ?? m.siglas[0];
      if (!anterior) {
        if (claves.has(codigo)) codigo = `MAT-${huella(normalizar(m.nombre)).slice(0, 18).toUpperCase()}`;
        if (claves.has(codigo)) throw new Error(`Identificador ocupado para ${m.nombre}`);
        claves.add(codigo);
        nuevasMaterias.push({ codigo_materia: codigo, nombre: m.nombre });
      }
      for (const sigla of m.siglas) {
        if (!anterior?.siglas.some(s => s.sigla === sigla)) nuevasSiglas.push({ codigo_materia: codigo, sigla });
      }
    }
    const nuevasAulas = catalogo.aulas.filter(a => !aulas.some(actual => actual.codigo_ambiente === a.codigo)).map(a => ({
      codigo_ambiente: a.codigo, nombre: a.nombre, lugar: a.lugar, piso: a.piso, tipo: a.tipo, capacidad: 0,
    }));
    if (aplicar) {
      if (nuevasMaterias.length) await tx.materia.createMany({ data: nuevasMaterias });
      if (nuevasSiglas.length) await tx.materia_sigla.createMany({ data: nuevasSiglas });
      if (nuevasAulas.length) await tx.ambiente.createMany({ data: nuevasAulas });
      const posteriores = await Promise.all([tx.docente.findMany({ orderBy: { id_docente: 'asc' } }), tx.paralelo.findMany({ orderBy: { id_paralelo: 'asc' } }), tx.horario.findMany({ orderBy: { id_horario: 'asc' } })]);
      if (huella(anteriores) !== huella(posteriores)) throw new Error('Cambió información ajena al catálogo; se revierte la importación.');
    }
    return { modo: aplicar ? 'APLICADO' : 'VISTA PREVIA (usa --apply para guardar)', fuente: catalogo.fuente,
      materiasEnPDF: catalogo.materias.length, aulasEnPDF: catalogo.aulas.length,
      materiasNuevas: nuevasMaterias.length, siglasNuevas: nuevasSiglas.length, aulasNuevas: nuevasAulas.length,
      registrosConservados: { docentes: anteriores[0].length, asignaciones: anteriores[1].length, horarios: anteriores[2].length },
      nota: 'INF-244 se conserva en dos materias distintas. La API clasifica por nombre usando el catálogo curricular de las siete menciones. No se sobrescriben aulas ni materias existentes.' };
  });
  console.log(JSON.stringify(resultado, null, 2));
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
