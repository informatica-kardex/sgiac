import { prisma } from "../../database/prisma";

export interface CreateBitacoraInput {
  accion: string;
  entidadAfectada?: string;
  idRegistroAfectado?: bigint | number | string;
  detalle?: string;
  idUsuario?: bigint | number;
}

export class AuditRepository {
  async create(input: CreateBitacoraInput) {
    return prisma.bitacora.create({
      data: {
        accion: input.accion,
        entidadAfectada: input.entidadAfectada ?? "usuario",
        idRegistroAfectado: input.idRegistroAfectado?.toString(),
        detalle: input.detalle,
        idUsuario: input.idUsuario,
      },
    });
  }

  async findByUsuario(idUsuario: bigint | number) {
    return prisma.bitacora.findMany({
      where: { idUsuario },
      orderBy: { fechaHora: "desc" },
    });
  }
}