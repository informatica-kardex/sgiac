import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { ApiError } from '../../utils/apiError';
import { academicTransaction, idSchema } from './academico.shared';
import { auxiliarSchema, vincularAuxiliarSchema } from './academico.validation';
import { mapAsignacion } from './academico.service';

const studentSelect = {
  id_estudiante: true, id_usuario: true, nombres: true, apellidos: true, ru: true, ci: true,
  correo_institucional: true, usuario: { select: { estado: true, correo: true } },
} satisfies Prisma.estudianteSelect;
type Student = Prisma.estudianteGetPayload<{ select: typeof studentSelect }>;
function motivoNoDisponible(e: Student) {
  if (!e.usuario) return 'Sin cuenta institucional. Crea su cuenta desde Estudiantes.';
  if (e.usuario.estado !== 'ACTIVO') return 'La cuenta del estudiante está inactiva.';
  if (!/@(fcpn\.edu\.bo|umsa\.bo)$/i.test(e.usuario.correo) || e.usuario.correo.toLowerCase() !== e.correo_institucional.toLowerCase()) {
    return 'El estudiante debe tener una cuenta con su correo institucional.';
  }
  return '';
}
async function asignacionActiva(tx: Prisma.TransactionClient, id: string) {
  const p = await tx.paralelo.findUnique({ where: { id_paralelo: BigInt(id) }, include: { docente: true, materia: true, periodo_academico: true } });
  if (!p) throw ApiError.notFound('Asignación docente no encontrada');
  if ([p.estado, p.docente.estado, p.materia.estado, p.periodo_academico.estado].some(e => e !== 'ACTIVO')) {
    throw ApiError.conflict('La materia, el docente, el paralelo y el periodo deben estar activos.');
  }
  return p;
}

export const auxiliarService = {
  async estudiantes() {
    return (await prisma.estudiante.findMany({
      orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }],
      select: { ...studentSelect, auxiliar: { select: { id_auxiliar: true, estado: true } } },
    })).map(e => ({
      idEstudiante: String(e.id_estudiante), idUsuario: e.id_usuario ? String(e.id_usuario) : null,
      nombreCompleto: e.nombres + ' ' + e.apellidos, correo: e.correo_institucional, ci: e.ci, ru: e.ru,
      idAuxiliar: e.auxiliar?.estado === 'ACTIVO' ? String(e.auxiliar.id_auxiliar) : null,
      motivoNoDisponible: motivoNoDisponible(e),
    }));
  },
  async listar() {
    return (await prisma.auxiliar.findMany({ orderBy: { nombre_completo: 'asc' }, include: {
      estudiante: { select: studentSelect },
      asignaciones: { include: { paralelo: { include: { materia: { include: { siglas: true } }, docente: true, periodo_academico: true } } } },
    } })).map(a => ({
      idAuxiliar: String(a.id_auxiliar), idEstudiante: a.id_estudiante ? String(a.id_estudiante) : null,
      idUsuario: a.estudiante?.id_usuario ? String(a.estudiante.id_usuario) : null,
      nombreCompleto: a.estudiante ? a.estudiante.nombres + ' ' + a.estudiante.apellidos : a.nombre_completo,
      correo: a.estudiante?.correo_institucional ?? a.correo ?? '', telefono: a.telefono ?? '',
      ru: a.estudiante?.ru ?? '', estado: a.estado,
      cuentaActiva: a.estudiante ? !motivoNoDisponible(a.estudiante) : false,
      asignaciones: a.asignaciones.map(v => mapAsignacion(v.paralelo)),
    }));
  },
  async guardar(body: unknown, id?: string) {
    const p = auxiliarSchema.parse(body);
    const key = id ? BigInt(idSchema.parse(id)) : undefined;
    return academicTransaction(async tx => {
      const e = await tx.estudiante.findUnique({ where: { id_estudiante: BigInt(p.idEstudiante) }, select: studentSelect });
      if (!e) throw ApiError.notFound('Estudiante no encontrado');
      const motivo = motivoNoDisponible(e);
      if (motivo) throw ApiError.conflict(motivo);
      const paralelo = await asignacionActiva(tx, p.idAsignacion);
      const existing = await tx.auxiliar.findUnique({ where: { id_estudiante: e.id_estudiante } });
      const legacy = key ? await tx.auxiliar.findUnique({ where: { id_auxiliar: key } }) : null;
      if (key && !legacy) throw ApiError.notFound('Auxiliar no encontrado');
      if (legacy?.id_estudiante) throw ApiError.conflict('Este auxiliar ya está vinculado a un estudiante.');
      if (existing && (key || existing.estado === 'ACTIVO')) throw ApiError.conflict('El estudiante ya tiene un registro de auxiliar.');
      const data = { id_estudiante: e.id_estudiante, nombre_completo: e.nombres + ' ' + e.apellidos,
        correo: e.correo_institucional, estado: 'ACTIVO' };
      const current = legacy ?? existing;
      const a = current ? await tx.auxiliar.update({ where: { id_auxiliar: current.id_auxiliar }, data }) : await tx.auxiliar.create({ data });
      await tx.auxiliar_asignacion.upsert({
        where: { id_auxiliar_id_paralelo: { id_auxiliar: a.id_auxiliar, id_paralelo: paralelo.id_paralelo } },
        create: { id_auxiliar: a.id_auxiliar, id_paralelo: paralelo.id_paralelo }, update: {},
      });
      return { idAuxiliar: String(a.id_auxiliar) };
    });
  },
  async quitar(id?: string) {
    const key = id ? BigInt(idSchema.parse(id)) : undefined;
    return academicTransaction(async tx => {
      const auxiliares = await tx.auxiliar.findMany({ where: key ? { id_auxiliar: key } : { estado: 'ACTIVO' }, select: { id_auxiliar: true } });
      if (key && !auxiliares.length) throw ApiError.notFound('Auxiliar no encontrado');
      const ids = auxiliares.map(a => a.id_auxiliar);
      if (await tx.horario.count({ where: { id_auxiliar: { in: ids }, estado: 'ASIGNADO', paralelo: { periodo_academico: { estado: 'ACTIVO' } } } })) {
        throw ApiError.conflict('Primero retira en Horarios las clases o reservas vigentes de los auxiliares que deseas quitar. No se quitó ningún auxiliar.');
      }
      await tx.auxiliar_asignacion.deleteMany({ where: { id_auxiliar: { in: ids } } });
      await tx.auxiliar.updateMany({ where: { id_auxiliar: { in: ids } }, data: { estado: 'INACTIVO' } });
      return { cantidad: ids.length };
    });
  },
  async vincular(id: string, body: unknown) {
    const key = BigInt(idSchema.parse(id)), p = vincularAuxiliarSchema.parse(body);
    return academicTransaction(async tx => {
      const a = await tx.auxiliar.findUnique({ where: { id_auxiliar: key }, include: { estudiante: { select: studentSelect } } });
      if (!a) throw ApiError.notFound('Auxiliar no encontrado');
      if (a.estado !== 'ACTIVO' || !a.estudiante || motivoNoDisponible(a.estudiante)) throw ApiError.conflict('Vincula primero al auxiliar con un estudiante que tenga una cuenta institucional activa.');
      const paralelo = await asignacionActiva(tx, p.idAsignacion);
      await tx.auxiliar_asignacion.upsert({
        where: { id_auxiliar_id_paralelo: { id_auxiliar: key, id_paralelo: paralelo.id_paralelo } },
        create: { id_auxiliar: key, id_paralelo: paralelo.id_paralelo }, update: {},
      });
    });
  },
  async desvincular(id: string, asignacion: string) {
    const id_auxiliar = BigInt(idSchema.parse(id)), id_paralelo = BigInt(idSchema.parse(asignacion));
    return academicTransaction(async tx => {
      if (await tx.horario.count({ where: { id_auxiliar, id_paralelo, estado: 'ASIGNADO', paralelo: { periodo_academico: { estado: 'ACTIVO' } } } })) throw ApiError.conflict('Primero retira los horarios vigentes de esta auxiliaría.');
      await tx.auxiliar_asignacion.deleteMany({ where: { id_auxiliar, id_paralelo } });
    });
  },
};
