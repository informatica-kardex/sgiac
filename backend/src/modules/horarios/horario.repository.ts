import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { ApiError } from '../../utils/apiError';
import { academicTransaction, idSchema } from '../academico/academico.shared';
import { ActualizarHorarioInput, CrearHorarioInput, crearHorarioSchema } from './horario.validation';
import { compartenFecha, diaDeFecha } from './horario.fechas';
import { nombreDocente } from '../academico/docente.nombre';
import { sendMail } from '../../utils/mail';
const include = { auxiliar: { include: { estudiante: { select: { correo_institucional: true } } } }, bloque_horario: true, ambiente: true,
  horario_base: { select: { codigo_ambiente: true } }, traslados: true,
  reserva_origen: { select: { paralelo: { select: { id_docente: true } } } },
  reubicaciones: { include: { auxiliar: { include: { estudiante: { select: { correo_institucional: true } } } }, horario_base: true, bloque_horario: true } },
  paralelo: { include: { materia: { include: { siglas: true } }, docente: true, periodo_academico: true } } } as const;
type Row = Prisma.horarioGetPayload<{ include: typeof include }>;
export function mapHorario(h: Row) {
  const esAuxiliar = Boolean(h.es_auxiliar || h.id_auxiliar);
  const esCoordinacion = !esAuxiliar && h.paralelo.codigo_materia === 'CPU';
  const responsable = esAuxiliar ? h.auxiliar?.nombre_completo ?? 'Auxiliar por designar' : `${esCoordinacion ? 'Coord. ' : ''}${nombreDocente(h.paralelo.docente)}`;
  return { idHorario: Number(h.id_horario), idAsignacion: String(h.id_paralelo), idDocente: String(h.paralelo.id_docente),
    idAuxiliar: h.id_auxiliar ? String(h.id_auxiliar) : null, esAuxiliar, esCoordinacion, sesionCompartida: h.sesion_compartida, responsable,
    fecha: h.fecha?.toISOString().slice(0, 10) ?? null, motivo: h.motivo ?? '',
    idHorarioBase: h.id_horario_base ? Number(h.id_horario_base) : null,
    idReservaOrigen: h.id_reserva_origen ? Number(h.id_reserva_origen) : null,
    aulaOriginal: h.horario_base?.codigo_ambiente ?? null,
    traslados: (h.traslados ?? []).filter(t => t.estado === 'ASIGNADO').map(t => ({ fecha: t.fecha!.toISOString().slice(0, 10), aula: t.codigo_ambiente })),
    reubicaciones: (h.reubicaciones ?? []).map(t => ({ idHorario: Number(t.id_horario_base), aula: t.codigo_ambiente, responsable: t.auxiliar?.nombre_completo ?? 'Auxiliar' })),
    codigoMateria: h.paralelo.codigo_materia, siglas: h.paralelo.materia.siglas.map(s => s.sigla),
    materia: h.paralelo.materia.nombre, docente: esAuxiliar ? `${responsable}${h.auxiliar ? ' (Auxiliar)' : ''}` : responsable, aula: h.codigo_ambiente,
    dia: h.dia_semana, horaInicio: h.bloque_horario.hora_inicio.toISOString().slice(11, 16),
    horaFin: h.bloque_horario.hora_fin.toISOString().slice(11, 16), grupo: h.paralelo.nombre_paralelo,
    idPeriodo: String(h.paralelo.id_periodo), periodo: `${h.paralelo.periodo_academico.periodo}/${h.paralelo.periodo_academico.gestion}`,
    lugar: h.ambiente.lugar, piso: h.ambiente.piso };
}
export class HorarioRepository {
  private async validarRetorno(tx: Prisma.TransactionClient, reserva: Row, ignorarReserva = false) {
    for (const traslado of reserva.reubicaciones ?? []) {
      const base = await tx.horario.findUnique({ where: { id_horario: traslado.id_horario_base! }, include });
      if (!base || base.traslados.some(t => t.fecha?.getTime() === traslado.fecha?.getTime())) continue;
      const ocupantes = await tx.horario.findMany({ where: { estado: 'ASIGNADO', codigo_ambiente: base.codigo_ambiente,
        dia_semana: base.dia_semana, id_horario: { notIn: [base.id_horario, ...(ignorarReserva ? [reserva.id_horario] : [])] },
        bloque_horario: { hora_inicio: { lt: base.bloque_horario.hora_fin }, hora_fin: { gt: base.bloque_horario.hora_inicio } },
        paralelo: { periodo_academico: { estado: 'ACTIVO' } },
      }, include });
      if (ocupantes.some(h => compartenFecha(
        { fecha: traslado.fecha, inicio: base.paralelo.periodo_academico.fecha_inicio, fin: base.paralelo.periodo_academico.fecha_fin, dia: base.dia_semana },
        { fecha: h.fecha, inicio: h.paralelo.periodo_academico.fecha_inicio, fin: h.paralelo.periodo_academico.fecha_fin, dia: h.dia_semana }))) {
        throw ApiError.conflict(`No se puede devolver al auxiliar a ${base.codigo_ambiente}: otra reserva ocupa su sesión del ${traslado.fecha!.toISOString().slice(0, 10)}. Modifica primero esa otra reserva.`);
      }
    }
  }
  async findByDocente(id: string) {
    const id_docente = BigInt(idSchema.parse(id));
    if (!await prisma.docente.findUnique({ where: { id_docente } })) throw ApiError.notFound('Docente no encontrado');
    const rows = await prisma.horario.findMany({ where: { paralelo: { id_docente } }, include });
    return rows.map(h => ({ ...mapHorario(h), estado: h.estado }));
  }
  async findAll(incluirTemporales = false) { return (await prisma.horario.findMany({ where: { estado: 'ASIGNADO', ...(!incluirTemporales ? { fecha: null } : {}), paralelo: { periodo_academico: { estado: 'ACTIVO' } } }, include })).map(mapHorario); }
  async findById(id: number) { const h = await prisma.horario.findUnique({ where: { id_horario: BigInt(id) }, include }); return h ? mapHorario(h) : undefined; }
  private async notificar(rows: Row[], cancelada = false) {
    const avisos: string[] = [];
    for (const row of rows) for (const t of row.reubicaciones ?? []) {
      const correo = t.auxiliar?.estudiante?.correo_institucional || t.auxiliar?.correo;
      const fecha = t.fecha!.toISOString().slice(0, 10).split('-').reverse().join('/');
      const origen = t.horario_base!.codigo_ambiente;
      const mensaje = cancelada
        ? `Se canceló o modificó la reserva del ${fecha} en ${origen}. El traslado a ${t.codigo_ambiente} queda sin efecto. Revisa Mi auxiliatura para consultar tu asignación actual.`
        : `El aula ${origen} será ocupada por ${nombreDocente(row.paralelo.docente)} el ${fecha}. Por ese día debes pasar en el aula ${t.codigo_ambiente}, de ${t.bloque_horario.hora_inicio.toISOString().slice(11, 16)} a ${t.bloque_horario.hora_fin.toISOString().slice(11, 16)}. Tu asignación semanal en ${origen} se conserva para las demás fechas. Consulta Mi auxiliatura para ver el cambio.`;
      try {
        if (!correo) throw new Error('Sin correo');
        await sendMail({ to: correo, subject: cancelada ? 'SGIAC · Cambio de traslado de aula' : 'SGIAC · Traslado de aula por un día', text: mensaje });
      } catch { avisos.push(`No se pudo enviar el correo a ${t.auxiliar?.nombre_completo ?? 'un auxiliar'}. Comunícale el cambio; la asignación actual está disponible en Mi auxiliatura y su QR.`); }
    }
    return avisos;
  }
  async create(input: CrearHorarioInput) { return (await this.createMany([input]))[0]; }
  // La aprobación de una solicitud y sus horarios comparten la transacción académica.
  async createInTransaction(tx: Prisma.TransactionClient, input: CrearHorarioInput) { return mapHorario(await this.save(tx, input)); }
  async createMany(inputs: CrearHorarioInput[]) {
    const rows = await academicTransaction(async tx => {
      const creados = [];
      for (const input of inputs) creados.push(await this.save(tx, input));
      return creados;
    });
    const avisos = await this.notificar(rows);
    return rows.map(h => ({ ...mapHorario(h), avisos }));
  }
  async update(id: number, input: ActualizarHorarioInput) {
    const result = await academicTransaction(async tx => {
      const old = await tx.horario.findUnique({ where: { id_horario: BigInt(id) }, include });
      const current = await this.save(tx, input, id);
      if (old) await this.validarRetorno(tx, old);
      return { old, current };
    });
    const avisos = [...await this.notificar(result.old ? [result.old] : [], true), ...await this.notificar([result.current])];
    return { ...mapHorario(result.current), avisos };
  }
  private async save(tx: Prisma.TransactionClient, input: ActualizarHorarioInput, id?: number, traslado?: { base: Row; reserva: bigint; docente: bigint }): Promise<Row> {
      const old = id ? await tx.horario.findUnique({ where: { id_horario: BigInt(id) }, include }) : null;
      if (id && !old) throw ApiError.notFound('Horario no encontrado');
      if (old?.id_solicitud_aula) throw ApiError.conflict('Esta reserva pertenece a una solicitud. Cancélala en Solicitudes de aulas antes de modificarla.');
      if (old?.id_horario_base) throw ApiError.conflict('Modifica o elimina la reserva docente que originó este traslado.');
      if (old?.traslados?.length) throw ApiError.conflict('Esta clase semanal tiene traslados vinculados. Conserva la asignación y gestiona sus reservas por separado.');
      const p = crearHorarioSchema.parse({ ...(old ? mapHorario(old) : {}), ...input });
      if (old && !old.fecha && p.fecha) throw ApiError.conflict('La clase semanal debe conservarse. Crea una reserva temporal nueva en lugar de reemplazarla.');
      if (old?.reubicaciones?.length) await tx.horario.deleteMany({ where: { id_reserva_origen: old.id_horario } });
      const esAuxiliar = Boolean(p.esAuxiliar || p.idAuxiliar);
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
        const vinculo = await tx.auxiliar_asignacion.findUnique({ where: { id_auxiliar_id_paralelo: { id_auxiliar: BigInt(p.idAuxiliar), id_paralelo: asignacion.id_paralelo } }, include: { auxiliar: { include: { estudiante: { include: { usuario: { select: { estado: true } } } } } } } });
        if (!vinculo || vinculo.auxiliar.estado !== 'ACTIVO') throw ApiError.badRequest('Selecciona un auxiliar activo vinculado a esta materia, docente y paralelo.');
        if (vinculo.auxiliar.id_estudiante && vinculo.auxiliar.estudiante?.usuario?.estado !== 'ACTIVO') throw ApiError.conflict('La cuenta institucional del auxiliar está inactiva o no está disponible.');
      }
      const inicio = new Date(`1970-01-01T${p.horaInicio}:00.000Z`), fin = new Date(`1970-01-01T${p.horaFin}:00.000Z`);
      const candidatos = await tx.horario.findMany({ where: {
        ...(id ? { id_horario: { not: BigInt(id) } } : {}), estado: 'ASIGNADO', dia_semana: p.dia,
        paralelo: { periodo_academico: { estado: 'ACTIVO' } },
        bloque_horario: { hora_inicio: { lt: fin }, hora_fin: { gt: inicio } },
        OR: [{ codigo_ambiente: p.aula }, { id_paralelo: asignacion.id_paralelo }, ...(p.idAuxiliar || (!esAuxiliar && asignacion.codigo_materia !== 'CPU') ? [p.idAuxiliar
            ? { id_auxiliar: BigInt(p.idAuxiliar) }
            : { id_auxiliar: null, es_auxiliar: false, paralelo: { id_docente: asignacion.id_docente, codigo_materia: { not: 'CPU' } } }] : [])],
      }, include });
      const coincideFecha = (h: Row) => compartenFecha(
        { fecha, inicio: asignacion.periodo_academico.fecha_inicio, fin: asignacion.periodo_academico.fecha_fin, dia: p.dia },
        { fecha: h.fecha, inicio: h.paralelo.periodo_academico.fecha_inicio, fin: h.paralelo.periodo_academico.fecha_fin, dia: h.dia_semana });
      const reservaDelDocente = (h: Row, docente: bigint) => Boolean(fecha && h.fecha?.getTime() === fecha.getTime() &&
        h.codigo_ambiente !== p.aula && !h.es_auxiliar && !h.id_auxiliar && h.paralelo.id_docente === docente);
      const efectivos = candidatos.filter(h => h.id_horario !== traslado?.base.id_horario &&
        // La reserva que provoca el traslado puede ser del titular del mismo paralelo.
        // Esta excepción solo enlaza ese docente con su auxiliar en el aula alternativa.
        !(traslado && h.id_horario === traslado.reserva && h.codigo_ambiente !== p.aula && !h.es_auxiliar && !h.id_auxiliar) &&
        !(traslado && reservaDelDocente(h, traslado.docente)) &&
        // Un docente puede reservar varios ambientes para una actividad puntual.
        // La excepción nunca libera el aula ni permite cruces con clases semanales.
        !(!esAuxiliar && reservaDelDocente(h, asignacion.id_docente)) &&
        !(!esAuxiliar && fecha && h.fecha?.getTime() === fecha.getTime() && h.codigo_ambiente !== p.aula &&
          h.id_horario_base && h.reserva_origen?.paralelo.id_docente === asignacion.id_docente) &&
        !(fecha && !h.fecha && h.traslados?.some(t => t.estado === 'ASIGNADO' && t.fecha?.getTime() === fecha.getTime())));
      const desplazados = fecha && !esAuxiliar ? efectivos.filter(h => h.codigo_ambiente === p.aula && !h.fecha && (h.es_auxiliar || h.id_auxiliar) && coincideFecha(h)) : [];
      if (new Set(p.reubicaciones.map(r => r.idHorario)).size !== p.reubicaciones.length ||
          p.reubicaciones.some(r => !desplazados.some(h => Number(h.id_horario) === r.idHorario))) throw ApiError.badRequest('Las reubicaciones no corresponden a los auxiliares que ocupan esta aula y fecha. Actualiza el formulario.');
      for (const h of desplazados) {
        if (!h.id_auxiliar) throw ApiError.conflict('Designa al auxiliar de la clase semanal antes de reservar su aula para poder notificarle el traslado.');
        if (!p.reubicaciones.some(r => r.idHorario === Number(h.id_horario) && r.aula !== p.aula)) throw ApiError.conflict(`Elige otra aula para ${h.auxiliar?.nombre_completo ?? 'el auxiliar'} por ese día. Su clase semanal se conservará.`);
      }
      // Only source-verified shared sessions may overlap. Changing the class,
      // responsible person or time detaches this row from that shared session.
      const compartida = old?.sesion_compartida && old.id_paralelo === asignacion.id_paralelo &&
        Boolean(old.es_auxiliar || old.id_auxiliar) === esAuxiliar && (old.id_auxiliar?.toString() ?? null) === p.idAuxiliar &&
        old.dia_semana === p.dia && old.fecha?.getTime() === fecha?.getTime() &&
        old.bloque_horario.hora_inicio.getTime() === inicio.getTime() && old.bloque_horario.hora_fin.getTime() === fin.getTime()
        ? old.sesion_compartida : null;
      const conflicto = efectivos.filter(h => !desplazados.includes(h)).find(h => !(compartida && h.sesion_compartida === compartida &&
        h.paralelo.codigo_materia === asignacion.codigo_materia && Boolean(h.es_auxiliar || h.id_auxiliar) === esAuxiliar &&
        (h.id_auxiliar?.toString() ?? null) === p.idAuxiliar && (esAuxiliar || h.paralelo.id_docente === asignacion.id_docente) &&
        (h.codigo_ambiente !== p.aula || (old?.codigo_ambiente === p.aula && h.id_paralelo !== old.id_paralelo)) &&
        h.dia_semana === p.dia && h.bloque_horario.hora_inicio.getTime() === inicio.getTime() && h.bloque_horario.hora_fin.getTime() === fin.getTime()) && compartenFecha(
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
        ...(traslado ? { id_horario_base: traslado.base.id_horario, id_reserva_origen: traslado.reserva } : {}),
        fecha, motivo: fecha ? p.motivo : null, id_auxiliar: p.idAuxiliar ? BigInt(p.idAuxiliar) : null, es_auxiliar: esAuxiliar, sesion_compartida: compartida };
      const saved = id ? await tx.horario.update({ where: { id_horario: BigInt(id) }, data, include }) : await tx.horario.create({ data, include });
      for (const base of desplazados) {
        const destino = p.reubicaciones.find(r => r.idHorario === Number(base.id_horario))!;
        await this.save(tx, { idAsignacion: String(base.id_paralelo), aula: destino.aula, dia: base.dia_semana as CrearHorarioInput['dia'],
          horaInicio: base.bloque_horario.hora_inicio.toISOString().slice(11, 16), horaFin: base.bloque_horario.hora_fin.toISOString().slice(11, 16),
          idAuxiliar: String(base.id_auxiliar), esAuxiliar: true, fecha: p.fecha, motivo: `Traslado por reserva en ${p.aula}: ${p.motivo}`.slice(0, 200),
        }, undefined, { base, reserva: saved.id_horario, docente: asignacion.id_docente });
      }
      return desplazados.length ? (await tx.horario.findUnique({ where: { id_horario: saved.id_horario }, include }))! : saved;
  }
  async delete(id: number) {
    const horario = await academicTransaction(async tx => {
      const horario = await tx.horario.findUnique({ where: { id_horario: BigInt(id) }, include });
      if (!horario) throw ApiError.notFound('Horario no encontrado');
      if (horario.id_solicitud_aula) throw ApiError.conflict('Cancela la reserva desde Solicitudes de aulas para avisar al auxiliar y liberar sus horarios.');
      if (horario.id_horario_base) throw ApiError.conflict('Elimina la reserva docente que originó este traslado para devolver al auxiliar a su aula.');
      if (horario.traslados?.length) throw ApiError.conflict('Esta clase semanal tiene traslados vinculados y debe conservarse. Retira primero las reservas relacionadas.');
      if (horario.reubicaciones?.length) await tx.horario.deleteMany({ where: { id_reserva_origen: horario.id_horario } });
      await this.validarRetorno(tx, horario, true);
      await tx.horario.delete({ where: { id_horario: BigInt(id) } });
      return horario;
    });
    return { avisos: await this.notificar([horario], true) };
  }
}
