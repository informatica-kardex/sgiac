import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../database/prisma";
import { ApiError } from "../../utils/apiError";
import { rolesActivos } from "../roles/role.repository";
import { tienePermiso } from "../roles/permissions";
import { ACTIVAS, codigoDocumento, comprobarTransicion, disponibleDocumento, estimarRecojo } from "./documento.rules";
import { accionDocumentoSchema, configuracionDocumentoSchema, filtroDocumentoSchema, solicitarDocumentoSchema } from "./documento.validation";

export const documentoInclude = {
  estudiante: { select: { nombres: true, apellidos: true, ru: true, ci: true } },
  responsable: { select: { idUsuario: true, nombreCompleto: true } },
  eventos: { orderBy: { id: "desc" as const }, take: 50 },
  correos: { orderBy: { id: "desc" as const }, take: 2 },
} satisfies Prisma.SolicitudDocumentoInclude;
function dto(s: Prisma.SolicitudDocumentoGetPayload<{ include: typeof documentoInclude }>) {
  const aviso = (canal: string) => {
    const n = s.correos.find(c => c.canal === canal);
    return n ? { estado: n.estado, intentos: n.intentos, enviadoEn: n.enviadoEn?.toISOString() ?? null } : null;
  };
  return { id: String(s.id), codigo: s.codigo, idTipo: String(s.idTipo), documento: s.documento,
    solicitante: `${s.estudiante.nombres} ${s.estudiante.apellidos}`, ru: s.estudiante.ru, ci: s.estudiante.ci,
    nombres: s.estudiante.nombres, apellidos: s.estudiante.apellidos,
    motivo: s.motivo, detalle: s.detalle, estado: s.estado, creadaEn: s.creadaEn.toISOString(), estimadaEn: s.estimadaEn.toISOString(),
    fechaRecojo: s.fechaRecojo?.toISOString() ?? null, hojas: s.fechaRecojo ? s.hojas : null, lugar: s.lugar, requisitos: s.requisitos,
    version: s.version, correoHabilitado: s.correoHabilitado,
    responsable: s.responsable ? { id: String(s.responsable.idUsuario), nombre: s.responsable.nombreCompleto } : null,
    correo: aviso("CORREO"), telegram: aviso("TELEGRAM"),
    eventos: s.eventos.map(e => ({ id: String(e.id), estado: e.estado, descripcion: e.descripcion, fecha: e.fecha.toISOString() })),
  };
}
type Configuracion = z.infer<typeof configuracionDocumentoSchema>;
type Accion = z.infer<typeof accionDocumentoSchema>;
export class DocumentoService {
  private async estudiante(idUsuario: string) {
    const e = await prisma.estudiante.findUnique({ where: { id_usuario: BigInt(idUsuario) }, include: { usuario: true } });
    if (!e || e.usuario?.estado !== "ACTIVO") throw ApiError.forbidden("Necesitas un perfil de estudiante activo para solicitar documentos.");
    return e;
  }

  async tipos() {
    return (await prisma.tipoDocumento.findMany({ orderBy: { id: "asc" } })).map(t => ({ ...t, id: String(t.id), identificador: t.identificador ?? `DOC${t.id}`,
      desde: t.desde?.toISOString() ?? null, hasta: t.hasta?.toISOString() ?? null, disponible: disponibleDocumento(t) }));
  }

  async guardarTipo(id: string | null, input: Configuracion, idUsuario: string) {
    const { version, desde, hasta, ...rest } = input;
    const data = { ...rest, desde: desde ? new Date(desde) : null, hasta: hasta ? new Date(hasta) : null };
    return prisma.$transaction(async tx => {
      const repetido = await tx.tipoDocumento.findFirst({ where: { identificador: input.identificador, ...(id ? { id: { not: BigInt(id) } } : {}) } });
      if (repetido) throw ApiError.conflict("Este identificador ya pertenece a otro documento. Elige uno diferente.");
      if (id) {
        if (!version) throw ApiError.badRequest("Falta la versión de la configuración");
        const updated = await tx.tipoDocumento.updateMany({ where: { id: BigInt(id), version }, data: { ...data, version: { increment: 1 } } });
        if (!updated.count) throw ApiError.conflict("La configuración cambió. Vuelve a abrirla antes de guardar.");
      } else {
        id = String((await tx.tipoDocumento.create({ data })).id);
      }
      await tx.bitacora.create({ data: { idUsuario: BigInt(idUsuario), accion: "DOCUMENTO_CONFIGURADO", entidadAfectada: "tipo_documento", idRegistroAfectado: id, detalle: JSON.stringify(data) } });
      return { id };
    });
  }

  async portal(idUsuario: string) {
    const e = await this.estudiante(idUsuario);
    const [tipos, solicitudes] = await Promise.all([this.tipos(), prisma.solicitudDocumento.findMany({
      where: { idEstudiante: e.id_estudiante }, orderBy: { id: "desc" }, include: documentoInclude,
    })]);
    return { tipos, solicitudes: solicitudes.map(dto) };
  }

  async solicitar(idUsuario: string, input: z.infer<typeof solicitarDocumentoSchema>) {
    const e = await this.estudiante(idUsuario);
    return prisma.$transaction(async tx => {
      const idTipo = BigInt(input.idTipo);
      await tx.$queryRaw`SELECT id FROM tipo_documento WHERE id = ${idTipo} FOR UPDATE`;
      const tipo = await tx.tipoDocumento.findUnique({ where: { id: idTipo } });
      const ahora = new Date();
      if (!tipo || !disponibleDocumento(tipo, ahora)) throw ApiError.conflict("Las solicitudes de este documento no están habilitadas en este momento.");
      if (await tx.solicitudDocumento.findFirst({ where: { idTipo, idEstudiante: e.id_estudiante, estado: { in: ACTIVAS } } }))
        throw ApiError.conflict("Ya tienes una solicitud activa de este documento. Revisa su estado en Mis solicitudes.");
      const fecha = new Date(ahora.getTime() - 4 * 3600000).toISOString().slice(0, 10);
      const inicio = new Date(`${fecha}T00:00:00-04:00`);
      const ocupadas = await tx.solicitudDocumento.count({ where: { idTipo, creadaEn: { gte: inicio, lt: new Date(inicio.getTime() + 86400000) }, estado: { not: "CANCELADA" } } });
      if (ocupadas >= tipo.cupoDiario) throw ApiError.conflict("Se agotó el cupo de solicitudes de hoy. Intenta el siguiente día dentro del periodo habilitado.");
      const nueva = await tx.solicitudDocumento.create({ data: {
        idTipo, idEstudiante: e.id_estudiante, documento: tipo.nombre, motivo: input.motivo, detalle: input.detalle,
        creadaEn: ahora, estimadaEn: estimarRecojo(tipo, ahora), hojas: null, lugar: tipo.lugar,
        requisitos: tipo.requisitos, correoHabilitado: tipo.correoHabilitado,
      } });
      await tx.eventoDocumento.create({ data: { idSolicitud: nueva.id, idUsuario: BigInt(idUsuario), estado: "SOLICITADA", descripcion: "Solicitud recibida en la bandeja de Kardex. Espera la confirmación de recojo." } });
      return dto(await tx.solicitudDocumento.update({ where: { id: nueva.id }, data: { codigo: codigoDocumento(nueva.id, ahora, tipo.identificador ?? `DOC${tipo.id}`) }, include: documentoInclude }));
    });
  }

  async cancelar(idUsuario: string, id: string) {
    const e = await this.estudiante(idUsuario);
    return prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM solicitud_documento WHERE id = ${BigInt(id)} FOR UPDATE`;
      const s = await tx.solicitudDocumento.findFirst({ where: { id: BigInt(id), idEstudiante: e.id_estudiante } });
      if (!s) throw ApiError.notFound("Solicitud no encontrada");
      comprobarTransicion(s.estado, "CANCELAR");
      await tx.solicitudDocumento.update({ where: { id: s.id }, data: { estado: "CANCELADA", version: { increment: 1 } } });
      await tx.eventoDocumento.create({ data: { idSolicitud: s.id, idUsuario: BigInt(idUsuario), estado: "CANCELADA", descripcion: "Cancelada por el estudiante." } });
      return null;
    });
  }

  async responsables() {
    const usuarios = await prisma.usuario.findMany({ where: { estado: "ACTIVO", correoVerificado: true, debeCambiarPassword: false,
      roles: { some: { estado: "ACTIVO", rol: { estado: "ACTIVO", nombre: { in: ["ADMINISTRADOR", "SUBADMINISTRADOR"] } } } } },
      include: { permisos: true, roles: { include: { rol: true } } }, orderBy: { nombreCompleto: "asc" } });
    return usuarios.filter(u => tienePermiso({ roles: rolesActivos(u.roles), permisos: u.permisos }, "documentos"))
      .map(u => ({ id: String(u.idUsuario), nombre: u.nombreCompleto }));
  }

  async bandeja(filtro: z.infer<typeof filtroDocumentoSchema>) {
    const where: Prisma.SolicitudDocumentoWhereInput = { ...(filtro.estado ? { estado: filtro.estado } : {}),
      ...(filtro.q ? { OR: [
        { codigo: { contains: filtro.q, mode: "insensitive" } }, { motivo: { contains: filtro.q, mode: "insensitive" } },
        { estudiante: { OR: [{ ru: { contains: filtro.q } }, { ci: { contains: filtro.q } },
          { nombres: { contains: filtro.q, mode: "insensitive" } }, { apellidos: { contains: filtro.q, mode: "insensitive" } }] } },
      ] } : {}),
    };
    const [solicitudes, total, resumen] = await prisma.$transaction([
      prisma.solicitudDocumento.findMany({ where, orderBy: [{ estudiante: { apellidos: "asc" } }, { estudiante: { nombres: "asc" } }, { id: "desc" }], skip: (filtro.pagina - 1) * 30, take: 30, include: documentoInclude }),
      prisma.solicitudDocumento.count({ where }), prisma.solicitudDocumento.groupBy({ by: ["estado"], orderBy: { estado: "asc" }, _count: true }),
    ]);
    return { solicitudes: solicitudes.map(dto), total, pagina: filtro.pagina, resumen: Object.fromEntries(resumen.map(r => [r.estado, r._count])) };
  }

  async accion(id: string, input: Accion, idUsuario: string) {
    return prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM solicitud_documento WHERE id = ${BigInt(id)} FOR UPDATE`;
      const s = await tx.solicitudDocumento.findUnique({ where: { id: BigInt(id) } });
      if (!s) throw ApiError.notFound("Solicitud no encontrada");
      if (s.version !== input.version) throw ApiError.conflict("Otro administrativo actualizó esta solicitud. Actualiza y vuelve a abrirla.");
      comprobarTransicion(s.estado, input.accion);
      const data: Prisma.SolicitudDocumentoUncheckedUpdateInput = { version: { increment: 1 } };
      let descripcion = input.observacion;
      if (input.accion === "ASIGNAR") {
        let responsable = null;
        if (input.idResponsable) {
          const u = await tx.usuario.findUnique({ where: { idUsuario: BigInt(input.idResponsable) }, include: { permisos: true, roles: { include: { rol: true } } } });
          if (!u || u.estado !== "ACTIVO" || !u.correoVerificado || u.debeCambiarPassword || !tienePermiso({ roles: rolesActivos(u.roles), permisos: u.permisos }, "documentos"))
            throw ApiError.badRequest("El responsable debe tener acceso vigente a Solicitudes de documentos.");
          responsable = u;
        }
        data.idResponsable = responsable?.idUsuario ?? null;
        descripcion = responsable ? `Responsable asignado: ${responsable.nombreCompleto}.` : "Solicitud disponible en la bandeja sin responsable asignado.";
      }
      if (input.accion === "PREPARAR") {
        data.estado = "EN_PREPARACION"; data.idResponsable = s.idResponsable ?? BigInt(idUsuario);
        descripcion = "Kardex inició la preparación del documento.";
      }
      if (input.accion === "LISTA") {
        if (input.hojas === undefined || !Number.isInteger(input.hojas) || input.hojas < 0 || input.hojas > 100)
          throw ApiError.badRequest("Indica la cantidad de hojas antes de marcar el documento listo.");
        const tipo = await tx.tipoDocumento.findUniqueOrThrow({ where: { id: s.idTipo } });
        const fechaRecojo = input.fechaRecojo ? new Date(input.fechaRecojo) : estimarRecojo({ ...tipo, plazoHoras: 0 }, new Date(Date.now() + tipo.demoraRecojoMinutos * 60000));
        if (fechaRecojo.getTime() < Date.now() - 60000) throw ApiError.badRequest("La fecha de recojo debe ser actual o futura.");
        Object.assign(data, { estado: "LISTA", fechaRecojo, hojas: input.hojas, lugar: input.lugar, requisitos: input.requisitos });
        descripcion = `${s.estado === "LISTA" ? "Recojo reprogramado" : "Documento listo"}. Fecha: ${fechaRecojo.toLocaleString("es-BO", { timeZone: "America/La_Paz" })}. Hojas: ${input.hojas}. Lugar: ${input.lugar}. ${input.observacion}`;
      }
      if (input.accion === "ENTREGAR") { data.estado = "ENTREGADA"; descripcion = `Entrega registrada por Kardex. ${input.observacion}`; }
      if (input.accion === "RECHAZAR") { data.estado = "RECHAZADA"; descripcion = `Solicitud rechazada: ${input.observacion}`; }
      // Invalidar avisos pendientes anteriores al modificar los datos de recojo o cerrar la solicitud.
      if (["LISTA", "ENTREGAR", "RECHAZAR"].includes(input.accion))
        await tx.correoDocumento.updateMany({ where: { idSolicitud: s.id, estado: { in: ["PENDIENTE", "ERROR"] } }, data: { estado: "OMITIDO" } });
      if (input.accion === "LISTA") await tx.correoDocumento.createMany({ data: [
        { idSolicitud: s.id, version: s.version + 1, canal: "CORREO", estado: s.correoHabilitado ? "PENDIENTE" : "OMITIDO" },
        { idSolicitud: s.id, version: s.version + 1, canal: "TELEGRAM" },
      ] });
      await tx.solicitudDocumento.update({ where: { id: s.id }, data });
      await tx.eventoDocumento.create({ data: { idSolicitud: s.id, idUsuario: BigInt(idUsuario), estado: typeof data.estado === "string" ? data.estado : s.estado, descripcion } });
      return dto(await tx.solicitudDocumento.findUniqueOrThrow({ where: { id: s.id }, include: documentoInclude }));
    });
  }

  async reintentarCorreo(id: string, idUsuario: string, canal: "CORREO" | "TELEGRAM" = "CORREO") {
    return prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM solicitud_documento WHERE id = ${BigInt(id)} FOR UPDATE`;
      const s = await tx.solicitudDocumento.findUnique({ where: { id: BigInt(id) } });
      if (!s || s.estado !== "LISTA") throw ApiError.conflict("El documento debe estar listo para reenviar el aviso.");
      const correo = await tx.correoDocumento.findFirst({ where: { idSolicitud: s.id, canal }, orderBy: { id: "desc" } });
      if (!correo || correo.estado !== "ERROR") throw ApiError.conflict("Solo se pueden reintentar avisos con error.");
      await tx.correoDocumento.update({ where: { id: correo.id }, data: { estado: "PENDIENTE", intentos: 0, proximoIntento: new Date() } });
      await tx.eventoDocumento.create({ data: { idSolicitud: s.id, idUsuario: BigInt(idUsuario), estado: s.estado, descripcion: `Kardex solicitó reintentar el aviso por ${canal === "CORREO" ? "correo" : "Telegram"}.` } });
      return null;
    });
  }
}
export const documentoService = new DocumentoService();
