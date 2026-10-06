import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { ApiError } from '../../utils/apiError';
import { academicTransaction } from '../academico/academico.shared';
import { ActualizarHorarioInput, CrearHorarioInput, crearHorarioSchema } from './horario.validation';
import { compartenFecha, diaDeFecha } from './horario.fechas';
import { nombreDocente } from '../academico/docente.nombre';
const include = { auxiliar: true, bloque_horario: true, ambiente: true, paralelo: { include: { materia: { include: { siglas: true } }, docente: true, periodo_academico: true } } } as const;
type Row = Prisma.horarioGetPayload<{ include: typeof include }>;
export function mapHorario(h: Row) {
  return { idHorario: Number(h.id_horario), idAsignacion: String(h.id_paralelo), idDocente: String(h.paralelo.id_docente),
    idAuxiliar: h.id_auxiliar ? String(h.id_auxiliar) : null, responsable: h.auxiliar?.nombre_completo ?? nombreDocente(h.paralelo.docente),
    fecha: h.fecha?.toISOString().slice(0, 10) ?? null, motivo: h.motivo ?? '',
    codigoMateria: h.paralelo.codigo_materia, siglas: h.paralelo.materia.siglas.map(s => s.sigla),
    materia: h.paralelo.materia.nombre, docente: h.auxiliar ? `${h.auxiliar.nombre_completo} (Auxiliar)` : nombreDocente(h.paralelo.docente), aula: h.codigo_ambiente,
    dia: h.dia_semana, horaInicio: h.bloque_horario.hora_inicio.toISOString().slice(11, 16),
    horaFin: h.bloque_horario.hora_fin.toISOString().slice(11, 16), grupo: h.paralelo.nombre_paralelo,
    idPeriodo: String(h.paralelo.id_periodo), periodo: `${h.paralelo.periodo_academico.periodo}/${h.paralelo.periodo_academico.gestion}`,
    lugar: h.ambiente.lugar, piso: h.ambiente.piso };
}
export class HorarioRepository {
  async findAll(incluirTemporales = false) { return (await prisma.horario.findMany({ where: { estado: 'ASIGNADO', ...(!incluirTemporales ? { fecha: null } : {}), paralelo: { periodo_academico: { estado: 'ACTIVO' } } }, include })).map(mapHorario); }
  async findById(id: number) { const h = await prisma.horario.findUnique({ where: { id_horario: BigInt(id) }, include }); return h ? mapHorario(h) : undefined; }
  async create(input: CrearHorarioInput) { return academicTransaction(tx => this.save(tx, input)); }
  async createMany(inputs: CrearHorarioInput[]) {
    return academicTransaction(async tx => {
      const creados = [];
      for (const input of inputs) creados.push(await this.save(tx, input));
      return creados;
    });
  }
  async update(id: number, input: ActualizarHorarioInput) { return academicTransaction(tx => this.save(tx, input, id)); }
  private async save(tx: Prisma.TransactionClient, input: ActualizarHorarioInput, id?: number) {
      const old = id ? await tx.horario.findUnique({ where: { id_horario: BigInt(id) }, include }) : null;
      if (id && !old) throw ApiError.notFound('Horario no encontrado');
      const p = crearHorarioSchema.parse({ ...(old ? mapHorario(old) : {}), ...input });
      const asignacion = await tx.paralelo.findUnique({ where: { id_paralelo: BigInt(p.idAsignacion) }, include: { docente: true, materia: true, periodo_academico: true } });
      const aula = await tx.ambiente.findUnique({ where: { codigo_ambiente: p.aula } });
      if (!asignacion || !aula) throw ApiError.badRequest('Selecciona una asignación y un aula registradas.');
      if ([asignacion.estado, asignacion.docente.estado, asignacion.materia.estado, asignacion.periodo_academico.estado].some(e => e !== 'ACTIVO')) throw ApiError.conflict('La asignación, el docente, la materia y el periodo deben estar activos.');
      if (aula.estado !== 'DISPONIBLE') throw ApiError.conflict('El aula no está disponible.');
      const fecha = p.fecha ? new Date(`${p.fecha}T00:00:00Z`) : null;
      if (p.fecha && diaDeFecha(p.fecha) !== p.dia) throw ApiError.badRequest('La fecha debe corresponder al día seleccionado, de lunes a sábado.');
      if (fecha && (fecha < asignacion.periodo_academico.fecha_inicio || fecha > asignacion.periodo_academico.fecha_fin)) throw ApiError.badRequest('La reserva debe estar dentro de las fechas del periodo académico.');
      if (fecha && !p.motivo) throw ApiError.badRequest('Indica el motivo de la reserva temporal.');
      if (p.idAuxiliar) {
        const vinculo = await tx.auxiliar_asignacion.findUnique({ where: { id_auxiliar_id_paralelo: { id_auxiliar: BigInt(p.idAuxiliar), id_paralelo: asignacion.id_paralelo } }, include: { auxiliar: true } });
        if (!vinculo || vinculo.auxiliar.estado !== 'ACTIVO') throw ApiError.badRequest('Selecciona un auxiliar activo vinculado a esta materia, docente y paralelo.');
      }
      const inicio = new Date(`1970-01-01T${p.horaInicio}:00.000Z`), fin = new Date(`1970-01-01T${p.horaFin}:00.000Z`);
      const candidatos = await tx.horario.findMany({ where: {
        ...(id ? { id_horario: { not: BigInt(id) } } : {}), estado: 'ASIGNADO', dia_semana: p.dia,
        paralelo: { periodo_academico: { estado: 'ACTIVO' } },
        bloque_horario: { hora_inicio: { lt: fin }, hora_fin: { gt: inicio } },
        OR: [{ codigo_ambiente: p.aula }, { id_paralelo: asignacion.id_paralelo }, p.idAuxiliar
          ? { id_auxiliar: BigInt(p.idAuxiliar) }
          : { id_auxiliar: null, paralelo: { id_docente: asignacion.id_docente } }],
      }, include });
      const conflicto = candidatos.find(h => compartenFecha(
        { fecha, inicio: asignacion.periodo_academico.fecha_inicio, fin: asignacion.periodo_academico.fecha_fin, dia: p.dia },
        { fecha: h.fecha, inicio: h.paralelo.periodo_academico.fecha_inicio, fin: h.paralelo.periodo_academico.fecha_fin, dia: h.dia_semana },
      ));
      if (conflicto) {
        const h = mapHorario(conflicto);
        const causa = conflicto.codigo_ambiente === p.aula ? 'El aula está ocupada' : conflicto.id_paralelo === asignacion.id_paralelo ? 'El paralelo ya tiene otra clase' : p.idAuxiliar ? 'El auxiliar ya tiene otra clase' : 'El docente ya tiene otra clase';
        throw ApiError.conflict(`${causa}: ${h.materia}, ${h.aula}, ${h.dia}${h.fecha ? ` ${h.fecha}` : ''}, ${h.horaInicio}–${h.horaFin}. No se guardó ningún cambio de esta solicitud.`);
      }
      let bloque = await tx.bloque_horario.findFirst({ where: { hora_inicio: inicio, hora_fin: fin } });
      if (!bloque) {
        const last = await tx.bloque_horario.aggregate({ _max: { id_bloque: true } });
        bloque = await tx.bloque_horario.create({ data: { id_bloque: (last._max.id_bloque ?? 0) + 1, hora_inicio: inicio, hora_fin: fin } });
      }
      const data = { id_paralelo: asignacion.id_paralelo, codigo_ambiente: p.aula, dia_semana: p.dia, id_bloque: bloque.id_bloque, publicado: true,
        fecha, motivo: fecha ? p.motivo : null, id_auxiliar: p.idAuxiliar ? BigInt(p.idAuxiliar) : null };
      return mapHorario(id ? await tx.horario.update({ where: { id_horario: BigInt(id) }, data, include }) : await tx.horario.create({ data, include }));
  }
  async delete(id: number) {
    return academicTransaction(async tx => {
      if (!await tx.horario.findUnique({ where: { id_horario: BigInt(id) } })) throw ApiError.notFound('Horario no encontrado');
      await tx.horario.delete({ where: { id_horario: BigInt(id) } });
    });
  }
}
