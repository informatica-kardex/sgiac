import { ambiente, Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { ApiError } from '../../utils/apiError';
import { academicTransaction } from '../academico/academico.shared';
import { CrearAulaInput, ActualizarAulaInput, crearAulaSchema, nombreEquipoNormalizado } from './aula.validation';
const estados = { disponible: 'DISPONIBLE', mantenimiento: 'MANTENIMIENTO', inhabilitada: 'INHABILITADO' };
const include = { ambiente_equipamiento: { include: { equipamiento: true }, orderBy: { equipamiento: { nombre: 'asc' } } } } as const;
type AulaConEquipos = Prisma.ambienteGetPayload<{ include: typeof include }>;
export function mapAula(a: ambiente & Partial<Pick<AulaConEquipos, 'ambiente_equipamiento'>>) {
  return { idAula: a.codigo_ambiente, codigo: a.codigo_ambiente, nombre: a.nombre, capacidad: a.capacidad,
    ubicacion: a.ubicacion ?? '', lugar: a.lugar, piso: a.piso, tipo: a.tipo,
    equipamiento: (a.ambiente_equipamiento ?? []).map(e => ({ nombre: e.equipamiento.nombre, cantidad: e.cantidad })),
    estado: a.estado === 'DISPONIBLE' ? 'disponible' as const : a.estado === 'MANTENIMIENTO' ? 'mantenimiento' as const : 'inhabilitada' as const };
}
export class AulaRepository {
  async findAll() { return (await prisma.ambiente.findMany({ include, orderBy: [{ lugar: 'asc' }, { piso: 'asc' }, { codigo_ambiente: 'asc' }] })).map(mapAula); }
  async findById(id: string) { const a = await prisma.ambiente.findUnique({ where: { codigo_ambiente: id }, include }); return a ? mapAula(a) : undefined; }
  async create(input: CrearAulaInput) { return this.save(input); }
  async update(id: string, input: ActualizarAulaInput) { return this.save(input, id); }
  private async save(input: ActualizarAulaInput, id?: string) {
    return academicTransaction(async tx => {
      const old = id ? await tx.ambiente.findUnique({ where: { codigo_ambiente: id } }) : null;
      if (id && !old) throw ApiError.notFound('Aula no encontrada');
      const p = crearAulaSchema.parse({ ...(old ? mapAula(old) : {}), ...input });
      if (id && p.codigo !== id) throw ApiError.badRequest('El código del aula no puede cambiar.');
      if (id && p.estado !== 'disponible' && await tx.horario.count({ where: { codigo_ambiente: id, estado: 'ASIGNADO', paralelo: { periodo_academico: { estado: 'ACTIVO' } } } })) throw ApiError.conflict('El aula tiene horarios activos. Retíralos antes de inhabilitarla.');
      const data = { nombre: p.nombre, capacidad: p.capacidad, ubicacion: p.ubicacion, lugar: p.lugar, piso: p.piso, tipo: p.tipo, estado: estados[p.estado] };
      const aula = id ? await tx.ambiente.update({ where: { codigo_ambiente: id }, data }) : await tx.ambiente.create({ data: { codigo_ambiente: p.codigo, ...data } });
      // Omitir el campo conserva el inventario; una lista vacía lo retira del aula.
      if (input.equipamiento !== undefined) {
        const catalogo = await tx.equipamiento.findMany({ where: { estado: 'ACTIVO' }, orderBy: { id_equipamiento: 'asc' } });
        const relaciones = [];
        for (const e of p.equipamiento ?? []) {
          const equipo = catalogo.find(actual => nombreEquipoNormalizado(actual.nombre) === nombreEquipoNormalizado(e.nombre))
            ?? await tx.equipamiento.create({ data: { nombre: e.nombre } });
          relaciones.push({ codigo_ambiente: aula.codigo_ambiente, id_equipamiento: equipo.id_equipamiento, cantidad: e.cantidad });
        }
        await tx.ambiente_equipamiento.deleteMany({ where: { codigo_ambiente: aula.codigo_ambiente } });
        if (relaciones.length) await tx.ambiente_equipamiento.createMany({ data: relaciones });
      }
      return mapAula(await tx.ambiente.findUniqueOrThrow({ where: { codigo_ambiente: aula.codigo_ambiente }, include }));
    });
  }
  async delete(id: string) {
    return academicTransaction(async tx => {
      if (!await tx.ambiente.findUnique({ where: { codigo_ambiente: id } })) throw ApiError.notFound('Aula no encontrada');
      if (await tx.horario.count({ where: { codigo_ambiente: id } })) throw ApiError.conflict('El aula tiene horarios registrados. Elimínalos antes de borrar el aula.');
      await tx.ambiente.delete({ where: { codigo_ambiente: id } });
    });
  }
}
