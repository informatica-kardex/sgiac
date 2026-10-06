import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { ApiError } from "../../utils/apiError";
import { JornadaInput, TramiteInput } from "./ficha.validation";
import { ahoraBolivia, codigoFicha, ESPERA, PENDIENTES, fichaDTO, fichaInclude, jornadaDTO, jornadaInclude } from "./ficha.shared";

export class FichaRepository {
  async tramites() {
    return (await prisma.tramite_atencion.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }))
      .map(t => ({ idTramite: String(t.id_tramite), nombre: t.nombre, descripcion: t.descripcion }));
  }

  async guardarTramite(input: TramiteInput, id?: string) {
    try {
      const t = id ? await prisma.tramite_atencion.update({ where: { id_tramite: BigInt(id), activo: true }, data: input })
        : await prisma.tramite_atencion.create({ data: input });
      return { idTramite: String(t.id_tramite), nombre: t.nombre, descripcion: t.descripcion };
    } catch (e) { return this.errorDB(e); }
  }

  async borrarTramite(id: string) {
    return prisma.$transaction(async tx => {
      const idTramite = BigInt(id);
      await tx.$queryRaw`SELECT id_tramite FROM tramite_atencion WHERE id_tramite = ${idTramite} FOR UPDATE`;
      const tramite = await tx.tramite_atencion.findUnique({ where: { id_tramite: idTramite } });
      if (!tramite?.activo) throw ApiError.notFound("Trámite no encontrado");
      const pendientes = await tx.ficha_atencion.count({ where: {
        jornada_atencion: { id_tramite: idTramite, fecha: { gte: new Date(ahoraBolivia().fecha) } },
        estado_actual: { in: PENDIENTES },
      } });
      if (pendientes) throw ApiError.conflict("Este trámite tiene fichas pendientes. Completa la atención antes de eliminarlo.");
      // Baja lógica: conserva el nombre del trámite en las jornadas y fichas históricas.
      await tx.tramite_atencion.update({ where: { id_tramite: idTramite }, data: { activo: false } });
      await tx.jornada_atencion.updateMany({ where: { id_tramite: idTramite, fecha: { gte: new Date(ahoraBolivia().fecha) } }, data: { estado: "INACTIVO" } });
      return null;
    });
  }

  async jornadas(fecha: string) {
    return (await prisma.jornada_atencion.findMany({
      where: { fecha: new Date(fecha) }, include: jornadaInclude, orderBy: [{ hora_inicio: "asc" }, { id_jornada: "asc" }],
    })).map(jornadaDTO);
  }

  async guardarJornada(input: JornadaInput, idUsuario: string, id?: string) {
    const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
    const cupo = input.modoCupo === "TIEMPO" ? Math.floor((minutos(input.horaFin) - minutos(input.horaInicio)) / input.minutosPorEstudiante) : input.cupoTotal;
    if (cupo < 1) throw ApiError.badRequest("El horario no alcanza para atender a un estudiante con esa duración.");
    const now = ahoraBolivia();
    if (input.fecha < now.fecha) throw ApiError.badRequest("No se pueden configurar jornadas de fechas pasadas.");
    if (!id && input.fecha === now.fecha && `${input.horaFin}:00` <= now.hora) throw ApiError.badRequest("Ese horario ya terminó.");
    try {
      return await prisma.$transaction(async tx => {
        // Mantener el orden de bloqueos: trámite y luego jornada.
        if (input.idTramite) {
          const idTramite = BigInt(input.idTramite);
          await tx.$queryRaw`SELECT id_tramite FROM tramite_atencion WHERE id_tramite = ${idTramite} FOR UPDATE`;
          const tramite = await tx.tramite_atencion.findUnique({ where: { id_tramite: idTramite } });
          if (!tramite || (!tramite.activo && (!id || input.estado === "ACTIVO"))) throw ApiError.conflict("El trámite ya no está disponible.");
        } else if (!id) throw ApiError.badRequest("Selecciona un trámite.");
        if (id) {
          const idJornada = BigInt(id);
          await tx.$queryRaw`SELECT id_jornada FROM jornada_atencion WHERE id_jornada = ${idJornada} FOR UPDATE`;
          const actual = await tx.jornada_atencion.findUnique({ where: { id_jornada: idJornada }, include: jornadaInclude });
          if (!actual) throw ApiError.notFound("Jornada no encontrada");
          const dto = jornadaDTO(actual);
          if (actual.ficha_atencion.length && (dto.fecha !== input.fecha || dto.idTramite !== input.idTramite || dto.horaInicio !== input.horaInicio || dto.horaFin !== input.horaFin || dto.puesto !== input.puesto)) {
            throw ApiError.conflict("Una jornada con fichas emitidas conserva su trámite, fecha, horario y puesto. Puedes cambiar el cupo, duración o pausar la jornada.");
          }
          if (cupo < dto.ocupadas) throw ApiError.conflict(`El cupo no puede ser menor que las ${dto.ocupadas} fichas vigentes.`);
        }
        const data = {
          id_tramite: input.idTramite ? BigInt(input.idTramite) : null, fecha: new Date(input.fecha),
          hora_inicio: new Date(`1970-01-01T${input.horaInicio}:00Z`), hora_fin: new Date(`1970-01-01T${input.horaFin}:00Z`),
          cupo_total: cupo, modo_cupo: input.modoCupo, minutos_por_estudiante: input.minutosPorEstudiante,
          puesto: input.puesto, estado: input.estado,
        };
        const j = id ? await tx.jornada_atencion.update({ where: { id_jornada: BigInt(id) }, data, include: jornadaInclude })
          : await tx.jornada_atencion.create({ data: { ...data, id_usuario: BigInt(idUsuario) }, include: jornadaInclude });
        return jornadaDTO(j);
      });
    } catch (e) { return this.errorDB(e); }
  }

  async findAll(fecha = ahoraBolivia().fecha) {
    return (await prisma.ficha_atencion.findMany({ where: { jornada_atencion: { fecha: new Date(fecha) } },
      include: fichaInclude, orderBy: [{ id_jornada: "asc" }, { numero_ficha: "asc" }],
    })).map(fichaDTO);
  }

  async tablero() {
    const fecha = ahoraBolivia().fecha;
    const jornadas = await prisma.jornada_atencion.findMany({ where: { fecha: new Date(fecha) },
      include: { tramite: true, ficha_atencion: { orderBy: { numero_ficha: "asc" }, select: {
        numero_ficha: true, estado_actual: true,
        historial_ficha: { where: { estado: "LLAMADA" }, orderBy: { id_historial_ficha: "desc" }, take: 1, select: { id_historial_ficha: true, fecha_hora: true } },
      } } }, orderBy: { id_jornada: "asc" },
    });
    // El historial permanece aunque la ficha ya haya terminado o se recargue la TV.
    // Un rellamado mueve la misma ficha al inicio, sin ocupar dos lugares.
    const ultimosLlamados = jornadas.flatMap(j => j.ficha_atencion.flatMap(f => {
      const evento = f.historial_ficha[0];
      return evento ? [{
        evento: evento.id_historial_ficha.toString(), codigo: codigoFicha(j.id_jornada, f.numero_ficha),
        numero: f.numero_ficha, puesto: j.puesto, tramite: j.tramite?.nombre ?? "Atención general",
        estado: f.estado_actual, llamadaEn: evento.fecha_hora.toISOString(),
      }] : [];
    })).sort((a, b) => BigInt(a.evento) > BigInt(b.evento) ? -1 : BigInt(a.evento) < BigInt(b.evento) ? 1 : 0).slice(0, 5);
    return { fecha, actualizadoEn: new Date().toISOString(), ultimosLlamados, jornadas: jornadas.map(j => {
      const llamada = j.ficha_atencion.find(f => f.estado_actual === "LLAMADA");
      const evento = llamada?.historial_ficha[0];
      return {
        ...jornadaDTO(j),
        actual: llamada ? { codigo: codigoFicha(j.id_jornada, llamada.numero_ficha), numero: llamada.numero_ficha,
          evento: evento?.id_historial_ficha.toString() ?? null, llamadaEn: evento?.fecha_hora.toISOString() ?? null } : null,
        siguientes: j.ficha_atencion.filter(f => ESPERA.includes(f.estado_actual)).slice(0, 5).map(f => codigoFicha(j.id_jornada, f.numero_ficha)),
      };
    }) };
  }

  async siguiente(id: string, idUsuario: string) {
    const idJornada = BigInt(id);
    return prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id_jornada FROM jornada_atencion WHERE id_jornada = ${idJornada} FOR UPDATE`;
      const j = await tx.jornada_atencion.findUnique({ where: { id_jornada: idJornada } });
      if (!j) throw ApiError.notFound("Jornada no encontrada");
      const now = ahoraBolivia();
      if (j.estado !== "ACTIVO") throw ApiError.conflict("La jornada está pausada. Actívala para llamar turnos.");
      if (j.fecha.toISOString().slice(0, 10) !== now.fecha || j.hora_inicio.toISOString().slice(11, 19) > now.hora) throw ApiError.conflict("Solo puedes llamar turnos del día de hoy desde la hora de inicio.");
      const actual = await tx.ficha_atencion.findFirst({ where: { id_jornada: idJornada, estado_actual: "LLAMADA" }, include: fichaInclude });
      // Una repetición o dos administradores simultáneos nunca saltan al estudiante actual.
      if (actual) return fichaDTO(actual);
      const siguiente = await tx.ficha_atencion.findFirst({ where: { id_jornada: idJornada, estado_actual: { in: ESPERA } }, orderBy: { numero_ficha: "asc" } });
      if (!siguiente) throw ApiError.conflict("No hay fichas en espera.");
      return this.cambiarEstado(tx, siguiente.id_ficha, idJornada, idUsuario, "LLAMADA", "Llamado al siguiente turno");
    });
  }

  async accion(id: string, accion: "RELLAMAR" | "FINALIZAR" | "AUSENTE", idUsuario: string) {
    const idFicha = BigInt(id);
    return prisma.$transaction(async tx => {
      const f = await tx.ficha_atencion.findUnique({ where: { id_ficha: idFicha } });
      if (!f) throw ApiError.notFound("Ficha no encontrada");
      await tx.$queryRaw`SELECT id_jornada FROM jornada_atencion WHERE id_jornada = ${f.id_jornada} FOR UPDATE`;
      const actual = await tx.ficha_atencion.findUnique({ where: { id_ficha: idFicha } });
      if (actual?.estado_actual !== "LLAMADA") throw ApiError.conflict("La ficha ya no está en atención. Actualiza la cola.");
      const estado = accion === "FINALIZAR" ? "ATENDIDA" : accion === "AUSENTE" ? "NO PRESENTADA" : "LLAMADA";
      return this.cambiarEstado(tx, idFicha, f.id_jornada, idUsuario, estado, accion === "RELLAMAR" ? "Repetición de llamado" : "Atención registrada por Kardex");
    });
  }

  private async cambiarEstado(tx: Prisma.TransactionClient, idFicha: bigint, idJornada: bigint, idUsuario: string, estado: string, observacion: string) {
    await tx.ficha_atencion.update({ where: { id_ficha: idFicha }, data: { estado_actual: estado } });
    await tx.historial_ficha.create({ data: { id_ficha: idFicha, id_jornada: idJornada, id_usuario: BigInt(idUsuario), estado, observacion } });
    return fichaDTO(await tx.ficha_atencion.findUniqueOrThrow({ where: { id_ficha: idFicha }, include: fichaInclude }));
  }

  private errorDB(e: unknown): never {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") throw ApiError.conflict("Ya existe ese nombre de trámite o una jornada para ese trámite y fecha.");
      if (e.code === "P2025") throw ApiError.notFound("Registro no encontrado");
    }
    throw e;
  }
}
