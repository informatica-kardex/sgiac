import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { ApiError } from "../../utils/apiError";
import planesEstudio from "../academico/data/planes-estudio.json";
import { ahoraBolivia, fichaDTO, fichaInclude, jornadaDTO, jornadaInclude, jornadaVigente, ESPERA } from "../fichas/ficha.shared";
export { ahoraBolivia } from "../fichas/ficha.shared";

export class EstudianteService {
  async catalogoHorario(idUsuario: string) {
    await this.estudiante(idUsuario);
    const periodos = await prisma.periodo_academico.findMany({ where: { estado: "ACTIVO" }, orderBy: [{ gestion: "desc" }, { periodo: "desc" }] });
    return {
      menciones: planesEstudio.menciones,
      materias: planesEstudio.materias.map(m => ({ nombre: m.nombre, siglas: m.siglas, planes: m.planes.map(p => ({ mencion: p.mencion, semestre: p.semestre, orden: p.orden })) })),
      periodos: periodos.map(p => ({ id: String(p.id_periodo), nombre: `${p.periodo}/${p.gestion}`, desde: p.fecha_inicio.toISOString().slice(0, 10), hasta: p.fecha_fin.toISOString().slice(0, 10) })),
    };
  }
  private async estudiante(idUsuario: string) {
    const estudiante = await prisma.estudiante.findUnique({ where: { id_usuario: BigInt(idUsuario) }, include: { usuario: true } });
    if (!estudiante || estudiante.usuario?.estado !== "ACTIVO") throw ApiError.forbidden("Tu cuenta no tiene un perfil de estudiante activo. Contacta a Kardex.");
    return estudiante;
  }

  async perfil(idUsuario: string) {
    const e = await this.estudiante(idUsuario);
    return { nombres: e.nombres, apellidos: e.apellidos, ci: e.ci, ru: e.ru, correo: e.correo_institucional, mencion: e.carrera };
  }

  async jornadas(idUsuario: string) {
    await this.estudiante(idUsuario);
    const jornadas = await prisma.jornada_atencion.findMany({
      where: { estado: "ACTIVO", fecha: { gte: new Date(ahoraBolivia().fecha) }, OR: [{ id_tramite: null }, { tramite: { activo: true } }] },
      include: jornadaInclude, orderBy: [{ fecha: "asc" }, { hora_inicio: "asc" }],
    });
    return jornadas.filter(jornadaVigente).map(jornadaDTO);
  }

  async fichas(idUsuario: string) {
    const e = await this.estudiante(idUsuario);
    return (await prisma.ficha_atencion.findMany({ where: { id_estudiante: e.id_estudiante }, include: fichaInclude, orderBy: { id_ficha: "desc" } })).map(fichaDTO);
  }

  async solicitar(idUsuario: string, input: { idJornada: string; detalle: string }) {
    const e = await this.estudiante(idUsuario);
    const idJornada = BigInt(input.idJornada);
    try {
      return await prisma.$transaction(async tx => {
        const inicial = await tx.jornada_atencion.findUnique({ where: { id_jornada: idJornada } });
        if (!inicial) throw ApiError.notFound("Jornada no encontrada");
        if (inicial.id_tramite) await tx.$queryRaw`SELECT id_tramite FROM tramite_atencion WHERE id_tramite = ${inicial.id_tramite} FOR UPDATE`;
        await tx.$queryRaw`SELECT id_jornada FROM jornada_atencion WHERE id_jornada = ${idJornada} FOR UPDATE`;
        const jornada = await tx.jornada_atencion.findUnique({ where: { id_jornada: idJornada }, include: { tramite: true } });
        if (!jornada || !jornadaVigente(jornada) || jornada.tramite?.activo === false || jornada.id_tramite !== inicial.id_tramite) throw ApiError.conflict("La jornada ya no está disponible. Actualiza y elige otra fecha.");
        if (await tx.ficha_atencion.findFirst({ where: { id_jornada: idJornada, id_estudiante: e.id_estudiante, estado_actual: { not: "CANCELADA" } } })) throw ApiError.conflict("Ya tienes una ficha para este trámite y jornada. Revisa Mis fichas.");
        const ocupadas = await tx.ficha_atencion.count({ where: { id_jornada: idJornada, estado_actual: { not: "CANCELADA" } } });
        if (ocupadas >= jornada.cupo_total) throw ApiError.conflict("Se agotaron los cupos de esta jornada. Elige otra fecha.");
        const ultima = await tx.ficha_atencion.aggregate({ where: { id_jornada: idJornada }, _max: { numero_ficha: true } });
        const ahora = ahoraBolivia();
        const ficha = await tx.ficha_atencion.create({ data: {
          id_estudiante: e.id_estudiante, id_jornada: idJornada, numero_ficha: (ultima._max.numero_ficha ?? 0) + 1,
          motivo_atencion: [jornada.tramite?.nombre ?? "Atención general", input.detalle].filter(Boolean).join("\n\n"),
          estado_actual: "GENERADA", fecha_generacion: new Date(ahora.fecha), hora_generacion: new Date(`1970-01-01T${ahora.hora}Z`),
        } });
        await tx.historial_ficha.create({ data: { id_ficha: ficha.id_ficha, id_jornada: idJornada, id_usuario: BigInt(idUsuario), estado: "GENERADA", observacion: "Solicitud desde el portal de estudiantes" } });
        return fichaDTO(await tx.ficha_atencion.findUniqueOrThrow({ where: { id_ficha: ficha.id_ficha }, include: fichaInclude }));
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) throw ApiError.conflict("La disponibilidad cambió. Actualiza las jornadas e intenta nuevamente.");
      throw error;
    }
  }

  async cancelar(idUsuario: string, idFicha: string) {
    const e = await this.estudiante(idUsuario);
    return prisma.$transaction(async tx => {
      const f = await tx.ficha_atencion.findFirst({ where: { id_ficha: BigInt(idFicha), id_estudiante: e.id_estudiante } });
      if (!f) throw ApiError.notFound("Ficha no encontrada");
      await tx.$queryRaw`SELECT id_jornada FROM jornada_atencion WHERE id_jornada = ${f.id_jornada} FOR UPDATE`;
      const actual = await tx.ficha_atencion.findUniqueOrThrow({ where: { id_ficha: f.id_ficha }, include: { jornada_atencion: true } });
      if (!ESPERA.includes(actual.estado_actual) || actual.jornada_atencion.fecha.toISOString().slice(0, 10) < ahoraBolivia().fecha) throw ApiError.conflict("Solo puedes cancelar una ficha pendiente de hoy o de una fecha futura.");
      await tx.ficha_atencion.update({ where: { id_ficha: f.id_ficha }, data: { estado_actual: "CANCELADA" } });
      await tx.historial_ficha.create({ data: { id_ficha: f.id_ficha, id_jornada: f.id_jornada, id_usuario: BigInt(idUsuario), estado: "CANCELADA", observacion: "Cancelada por el estudiante; cupo liberado" } });
      return null;
    });
  }
}
