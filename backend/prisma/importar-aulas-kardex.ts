import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { prisma } from '../src/database/prisma';
import { crearAulaSchema, nombreEquipoNormalizado } from '../src/modules/aulas/aula.validation';

// Vista previa: npx ts-node prisma/importar-aulas-kardex.ts
// Guardar: añadir --apply --expected-current-sha=<huella de la vista previa>.
type Referencia = { fuente: string; sha256: string; notas: string[]; aulas: {
  codigo: string; capacidad: number | null; pagina: number; lugar: string; piso: number | null; tipo: string;
  equipamiento: { nombre: string; cantidad: number }[];
}[] };
const datos: Referencia = JSON.parse(readFileSync(join(__dirname, 'data/aulas-kardex.json'), 'utf8'));
const json = (v: unknown) => JSON.stringify(v, (_, x) => typeof x === 'bigint' ? String(x) : x, 2);
const hash = (v: unknown) => createHash('sha256').update(json(v)).digest('hex');
const equiposOrdenados = (v: { nombre: string; cantidad: number }[]) => v.map(e => ({ nombre: nombreEquipoNormalizado(e.nombre), cantidad: e.cantidad })).sort((a,b) => a.nombre.localeCompare(b.nombre));

async function main() {
  if (createHash('sha256').update(readFileSync(join(__dirname, '../../referencias', datos.fuente))).digest('hex') !== datos.sha256) throw Error('El PDF cambió; revisar la transcripción antes de cargar.');
  for (const a of datos.aulas) crearAulaSchema.parse({ ...a, nombre: a.codigo, capacidad: a.capacidad ?? 0 });
  if (new Set(datos.aulas.map(a => a.codigo)).size !== datos.aulas.length) throw Error('Hay aulas repetidas en la referencia.');
  const aplicar = process.argv.includes('--apply');
  const esperado = process.argv.find(a => a.startsWith('--expected-current-sha='))?.split('=')[1];
  const resultado = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(20260930, 1)`;
    const [aulas, horarios, equipamiento, relaciones] = await Promise.all([
      tx.ambiente.findMany({ orderBy: { codigo_ambiente: 'asc' } }), tx.horario.findMany({ orderBy: { id_horario: 'asc' } }),
      tx.equipamiento.findMany({ orderBy: { id_equipamiento: 'asc' } }),
      tx.ambiente_equipamiento.findMany({ orderBy: [{ codigo_ambiente: 'asc' }, { id_equipamiento: 'asc' }] }),
    ]);
    const antes = { aulas, horarios, equipamiento, relaciones }, huellaActual = hash(antes);
    if (aplicar && esperado !== huellaActual) throw Error('Se requiere la huella vigente de la vista previa; no se modificó ningún dato.');
    const renumerar = aulas.some(a => a.codigo_ambiente === 'P3-LAB4');
    if (renumerar && (!aulas.some(a => a.codigo_ambiente === 'P3-LAB3') || horarios.some(h => h.codigo_ambiente === 'P3-LAB2') || relaciones.some(r => r.codigo_ambiente === 'P3-LAB2'))) throw Error('Revisar el LAB2 de destino: debe estar vacío para trasladar el LAB3 sin mezclar horarios/inventarios.');
    const cambiarCodigo = (codigo: string) => renumerar ? ({ 'P3-LAB3': 'P3-LAB2', 'P3-LAB4': 'P3-LAB3' } as Record<string,string>)[codigo] ?? codigo : codigo;
    const cambios = datos.aulas.filter(a => {
      const existente = aulas.find(r => cambiarCodigo(r.codigo_ambiente) === a.codigo && (!renumerar || r.codigo_ambiente !== 'P3-LAB2'));
      const inventario = relaciones.filter(r => r.codigo_ambiente === existente?.codigo_ambiente).map(r => ({ nombre: equipamiento.find(e => e.id_equipamiento === r.id_equipamiento)!.nombre, cantidad: r.cantidad }));
      return !existente || a.lugar !== existente.lugar || a.piso !== existente.piso || a.tipo !== existente.tipo || (a.capacidad !== null && a.capacidad !== existente.capacidad) || hash(equiposOrdenados(inventario)) !== hash(equiposOrdenados(a.equipamiento));
    });
    let respaldo: string | undefined;
    if (aplicar && (renumerar || cambios.length)) {
      const carpeta = join(__dirname, 'backups'); mkdirSync(carpeta, { recursive: true });
      respaldo = join(carpeta, `antes-aulas-kardex-${Date.now()}-${randomUUID().slice(0,8)}.json`);
      writeFileSync(respaldo, json(antes), { flag: 'wx' });
      if (renumerar) {
        for (const [viejo, nuevo] of [['P3-LAB3','P3-LAB2'], ['P3-LAB4','P3-LAB3']]) {
          const { codigo_ambiente, ...data } = aulas.find(a => a.codigo_ambiente === viejo)!;
          await tx.ambiente.upsert({ where: { codigo_ambiente: nuevo }, create: { ...data, codigo_ambiente: nuevo, nombre: nuevo }, update: { ...data, nombre: nuevo } });
          await tx.horario.updateMany({ where: { codigo_ambiente: viejo }, data: { codigo_ambiente: nuevo } });
          await tx.ambiente_equipamiento.deleteMany({ where: { codigo_ambiente: nuevo } });
          await tx.ambiente_equipamiento.updateMany({ where: { codigo_ambiente: viejo }, data: { codigo_ambiente: nuevo } });
        }
        await tx.ambiente.delete({ where: { codigo_ambiente: 'P3-LAB4' } });
      }
      const nombres = [...new Set(cambios.flatMap(a => a.equipamiento.map(e => e.nombre)))];
      const nuevos = nombres.filter(n => !equipamiento.some(e => e.estado === 'ACTIVO' && nombreEquipoNormalizado(e.nombre) === nombreEquipoNormalizado(n)));
      if (nuevos.length) await tx.equipamiento.createMany({ data: nuevos.map(nombre => ({ nombre })) });
      const catalogo = await tx.equipamiento.findMany({ where: { estado: 'ACTIVO' }, orderBy: { id_equipamiento: 'asc' } });
      for (const a of cambios) {
        const data = { lugar: a.lugar, piso: a.piso, tipo: a.tipo, ...(a.capacidad === null ? {} : { capacidad: a.capacidad }) };
        await tx.ambiente.upsert({ where: { codigo_ambiente: a.codigo },
          create: { codigo_ambiente: a.codigo, nombre: a.codigo === 'PAB-E' ? 'Pabellón E' : a.codigo, ...data }, update: data });
      }
      await tx.ambiente_equipamiento.deleteMany({ where: { codigo_ambiente: { in: cambios.map(a => a.codigo) } } });
      const nuevasRelaciones = cambios.flatMap(a => a.equipamiento.map(e => ({ codigo_ambiente: a.codigo, cantidad: e.cantidad,
        id_equipamiento: catalogo.find(c => nombreEquipoNormalizado(c.nombre) === nombreEquipoNormalizado(e.nombre))!.id_equipamiento })));
      if (nuevasRelaciones.length) await tx.ambiente_equipamiento.createMany({ data: nuevasRelaciones });
      const despues = await tx.horario.findMany({ orderBy: { id_horario: 'asc' } });
      if (hash(despues) !== hash(horarios.map(h => ({ ...h, codigo_ambiente: cambiarCodigo(h.codigo_ambiente) })))) throw Error('La comprobación de conservación de horarios falló; se revierte la carga.');
      if (await tx.ambiente.count({ where: { codigo_ambiente: 'P3-LAB4' } })) throw Error('El código antiguo no se retiró.');
    }
    return { modo: aplicar ? 'APLICADO' : 'VISTA PREVIA', fuente: datos.fuente, huellaActual, respaldo,
      renumeracion: renumerar ? { 'P3-LAB3 → P3-LAB2': horarios.filter(h => h.codigo_ambiente === 'P3-LAB3').length, 'P3-LAB4 → P3-LAB3': horarios.filter(h => h.codigo_ambiente === 'P3-LAB4').length } : null,
      aulasActualizadas: cambios.map(a => a.codigo), aulasNuevas: cambios.filter(a => !aulas.some(r => r.codigo_ambiente === a.codigo)).map(a => a.codigo),
      horariosConservados: horarios.length, notas: datos.notas };
  }, { timeout: 120000, maxWait: 15000 });
  if (aplicar) writeFileSync(join(__dirname, 'data/resultado-aulas-kardex.json'), json(resultado));
  console.log(json(resultado));
}
main().catch(e => { console.error(e instanceof Error ? e.message : 'Error al cargar aulas'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
