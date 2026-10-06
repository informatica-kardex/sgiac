import { prisma } from '../../database/prisma';
import { randomUUID } from 'node:crypto';
import { compararPlanes, datosPlan } from './planes-estudio';
import { ApiError } from '../../utils/apiError';
import { academicTransaction, idSchema } from './academico.shared';
import { asignacionSchema, docenteSchema, materiaSchema, periodoSchema } from './academico.validation';
import { nombreDocente } from './docente.nombre';

const asignacionInclude = { materia: { include: { siglas: true } }, docente: true, periodo_academico: true } as const;
export function mapAsignacion(p: Awaited<ReturnType<typeof prisma.paralelo.findMany>>[number] & { materia: { nombre: string; siglas: { sigla: string }[] }; docente: { nombre_completo: string; grado_academico?: string | null }; periodo_academico: { gestion: number; periodo: string } }) {
  return { idAsignacion: String(p.id_paralelo), idDocente: String(p.id_docente), codigoMateria: p.codigo_materia,
    materia: p.materia.nombre, siglas: p.materia.siglas.map(s => s.sigla).sort(), docente: nombreDocente(p.docente), grupo: p.nombre_paralelo,
    idPeriodo: String(p.id_periodo), periodo: `${p.periodo_academico.periodo}/${p.periodo_academico.gestion}`, estado: p.estado };
}
export const academicoService = {
  async docentes() {
    const rows = await prisma.docente.findMany({ orderBy: { nombre_completo: 'asc' }, include: { paralelo: { include: asignacionInclude } } });
    return rows.map(d => ({ idDocente: String(d.id_docente), nombreCompleto: d.nombre_completo, gradoAcademico: d.grado_academico ?? '', nombreConGrado: nombreDocente(d), especialidad: d.especialidad ?? '',
      correo: d.correo ?? '', telefono: d.telefono ?? '', estado: d.estado, asignaciones: d.paralelo.map(mapAsignacion) }));
  },
  async guardarDocente(body: unknown, id?: string) {
    const input = docenteSchema.parse(body);
    return academicTransaction(async tx => {
      const key = id ? BigInt(idSchema.parse(id)) : undefined;
      if (key && !await tx.docente.findUnique({ where: { id_docente: key } })) throw ApiError.notFound('Docente no encontrado');
      if (key && input.estado === 'INACTIVO' && await tx.horario.count({ where: { estado: 'ASIGNADO', paralelo: { id_docente: key, periodo_academico: { estado: 'ACTIVO' } } } })) throw ApiError.conflict('El docente tiene horarios activos. Retíralos antes de desactivarlo.');
      // Omitir el campo conserva el grado; una cadena vacía lo deja por confirmar.
      const data = { nombre_completo: input.nombreCompleto, grado_academico: input.gradoAcademico === undefined ? undefined : input.gradoAcademico || null, especialidad: input.especialidad, correo: input.correo, telefono: input.telefono, estado: input.estado };
      const row = key ? await tx.docente.update({ where: { id_docente: key }, data }) : await tx.docente.create({ data });
      return { idDocente: String(row.id_docente) };
    });
  },
  async materias() {
    return (await prisma.materia.findMany({ include: { siglas: true }, orderBy: { nombre: 'asc' } })).map(m => ({
      codigo: m.codigo_materia, nombre: m.nombre, estado: m.estado, siglas: m.siglas.map(s => s.sigla).sort(),
      ...datosPlan(m.nombre),
      siglaPrincipal: m.siglas.find(s => s.sigla === m.codigo_materia)?.sigla ?? m.siglas.map(s => s.sigla).sort()[0] ?? m.codigo_materia,
    })).sort(compararPlanes);
  },
  async guardarMateria(body: unknown, codigo?: string) {
    const input = materiaSchema.parse(body);
    return academicTransaction(async tx => {
      if (codigo && codigo !== input.codigo) throw ApiError.badRequest('El identificador interno de la materia no se puede cambiar.');
      const anterior = codigo ? await tx.materia.findUnique({ where: { codigo_materia: codigo }, include: { siglas: true } }) : null;
      if (codigo && !anterior) throw ApiError.notFound('Materia no encontrada');
      if (codigo && input.estado === 'INACTIVO' && await tx.horario.count({ where: { estado: 'ASIGNADO', paralelo: { codigo_materia: codigo, periodo_academico: { estado: 'ACTIVO' } } } })) throw ApiError.conflict('La materia tiene horarios activos. Retíralos antes de desactivarla.');
      const principalAnterior = anterior?.siglas.find(s => s.sigla === codigo)?.sigla ?? anterior?.siglas.map(s => s.sigla).sort()[0];
      const siglas = [...new Set([input.siglaPrincipal ?? principalAnterior ?? input.codigo, ...input.siglas])];
      let key = input.codigo;
      if (!codigo && await tx.materia.findUnique({ where: { codigo_materia: key } })) key = `MAT-${randomUUID().slice(0, 18).toUpperCase()}`;
      const data = { nombre: input.nombre, estado: input.estado };
      if (codigo) await tx.materia.update({ where: { codigo_materia: codigo }, data });
      else await tx.materia.create({ data: { codigo_materia: key, ...data } });
      await tx.materia_sigla.deleteMany({ where: { codigo_materia: key } });
      await tx.materia_sigla.createMany({ data: siglas.map(sigla => ({ sigla, codigo_materia: key })) });
      return { codigo: key };
    });
  },
  async periodos() {
    return (await prisma.periodo_academico.findMany({ orderBy: [{ gestion: 'desc' }, { periodo: 'desc' }] })).map(p => ({
      idPeriodo: String(p.id_periodo), gestion: p.gestion, periodo: p.periodo, estado: p.estado,
      fechaInicio: p.fecha_inicio.toISOString().slice(0, 10), fechaFin: p.fecha_fin.toISOString().slice(0, 10),
    }));
  },
  async crearPeriodo(body: unknown) {
    const p = periodoSchema.parse(body);
    return academicTransaction(async tx => {
      const row = await tx.periodo_academico.create({ data: { gestion: p.gestion, periodo: p.periodo, fecha_inicio: new Date(p.fechaInicio), fecha_fin: new Date(p.fechaFin) } });
      return { idPeriodo: String(row.id_periodo) };
    });
  },
  async asignaciones() {
    return (await prisma.paralelo.findMany({ include: asignacionInclude, orderBy: { nombre_paralelo: 'asc' } })).map(mapAsignacion);
  },
  async asignar(body: unknown) {
    const p = asignacionSchema.parse(body);
    return academicTransaction(async tx => {
      const docente = await tx.docente.findUnique({ where: { id_docente: BigInt(p.idDocente) } });
      const materia = await tx.materia.findUnique({ where: { codigo_materia: p.codigoMateria } });
      const periodo = await tx.periodo_academico.findUnique({ where: { id_periodo: BigInt(p.idPeriodo) } });
      if (!docente || !materia || !periodo) throw ApiError.badRequest('Selecciona docente, materia y periodo registrados.');
      if ([docente.estado, materia.estado, periodo.estado].some(e => e !== 'ACTIVO')) throw ApiError.conflict('El docente, la materia y el periodo deben estar activos.');
      const anteriores = await tx.paralelo.findMany({ where: { codigo_materia: p.codigoMateria, id_periodo: BigInt(p.idPeriodo) } });
      if (anteriores.some(a => a.id_docente === BigInt(p.idDocente))) throw ApiError.conflict('Este docente ya tiene esta materia asignada en el periodo.');
      // Base 26: A…Z, AA…AZ, BA…; conserva los paralelos ya registrados.
      const ordinal = (nombre: string) => /^[A-Z]+$/.test(nombre) ? [...nombre].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) : 0;
      let siguiente = Math.max(0, ...anteriores.map(a => ordinal(a.nombre_paralelo))) + 1;
      let grupo = '';
      while (siguiente > 0) { siguiente--; grupo = String.fromCharCode(65 + siguiente % 26) + grupo; siguiente = Math.floor(siguiente / 26); }
      const where = { codigo_materia: p.codigoMateria, id_periodo: BigInt(p.idPeriodo), nombre_paralelo: grupo };
      return mapAsignacion(await tx.paralelo.create({ data: { ...where, id_docente: BigInt(p.idDocente) }, include: asignacionInclude }));
    });
  },
  async quitarAsignacion(id: string) {
    return academicTransaction(async tx => {
      const key = BigInt(idSchema.parse(id));
      if (!await tx.paralelo.findUnique({ where: { id_paralelo: key } })) throw ApiError.notFound('Asignación no encontrada');
      if (await tx.horario.count({ where: { id_paralelo: key } })) throw ApiError.conflict('Primero elimina los horarios de esta asignación.');
      await tx.paralelo.delete({ where: { id_paralelo: key } });
    });
  },
};
