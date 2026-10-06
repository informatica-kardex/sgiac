import { prisma } from '../../database/prisma';
import { ApiError } from '../../utils/apiError';
import { academicTransaction, idSchema } from './academico.shared';
import { auxiliarSchema, vincularAuxiliarSchema } from './academico.validation';
import { mapAsignacion } from './academico.service';

export const auxiliarService = {
  async listar() {
    return (await prisma.auxiliar.findMany({ orderBy: { nombre_completo: 'asc' }, include: { asignaciones: { include: { paralelo: { include: { materia: { include: { siglas: true } }, docente: true, periodo_academico: true } } } } } })).map(a => ({
      idAuxiliar: String(a.id_auxiliar), nombreCompleto: a.nombre_completo, correo: a.correo ?? '', telefono: a.telefono ?? '', estado: a.estado,
      asignaciones: a.asignaciones.map(v => mapAsignacion(v.paralelo)),
    }));
  },
  async guardar(body: unknown, id?: string) {
    const p = auxiliarSchema.parse(body);
    return academicTransaction(async tx => {
      const key = id ? BigInt(idSchema.parse(id)) : undefined;
      if (key && !await tx.auxiliar.findUnique({ where: { id_auxiliar: key } })) throw ApiError.notFound('Auxiliar no encontrado');
      if (key && p.estado === 'INACTIVO' && await tx.horario.count({ where: { id_auxiliar: key, estado: 'ASIGNADO', paralelo: { periodo_academico: { estado: 'ACTIVO' } } } })) throw ApiError.conflict('Retira los horarios del auxiliar antes de desactivarlo.');
      const data = { nombre_completo: p.nombreCompleto, correo: p.correo, telefono: p.telefono, estado: p.estado };
      const a = key ? await tx.auxiliar.update({ where: { id_auxiliar: key }, data }) : await tx.auxiliar.create({ data });
      return { idAuxiliar: String(a.id_auxiliar) };
    });
  },
  async vincular(id: string, body: unknown) {
    const key = BigInt(idSchema.parse(id)), p = vincularAuxiliarSchema.parse(body);
    return academicTransaction(async tx => {
      const a = await tx.auxiliar.findUnique({ where: { id_auxiliar: key } });
      const paralelo = await tx.paralelo.findUnique({ where: { id_paralelo: BigInt(p.idAsignacion) }, include: { docente: true, materia: true, periodo_academico: true } });
      if (!a || !paralelo) throw ApiError.notFound('Auxiliar o asignación no encontrados');
      if ([a.estado, paralelo.estado, paralelo.docente.estado, paralelo.materia.estado, paralelo.periodo_academico.estado].some(e => e !== 'ACTIVO')) throw ApiError.conflict('El auxiliar y la asignación deben estar activos.');
      await tx.auxiliar_asignacion.create({ data: { id_auxiliar: key, id_paralelo: paralelo.id_paralelo } });
    });
  },
  async desvincular(id: string, asignacion: string) {
    const id_auxiliar = BigInt(idSchema.parse(id)), id_paralelo = BigInt(idSchema.parse(asignacion));
    return academicTransaction(async tx => {
      if (await tx.horario.count({ where: { id_auxiliar, id_paralelo } })) throw ApiError.conflict('Primero retira los horarios de esta auxiliaría.');
      await tx.auxiliar_asignacion.deleteMany({ where: { id_auxiliar, id_paralelo } });
    });
  },
};
