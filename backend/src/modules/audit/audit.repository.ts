import { prisma } from "../../database/prisma";
import { AuditQuery, auditWhere, resultWhere, auditKind, auditResult } from './audit.query';
import { parseAuditDetail, sanitizeAudit } from './audit.context';
import type { Prisma } from '@prisma/client';

const include = { usuario: { select: { idUsuario: true, nombreCompleto: true, correo: true } } } as const;
const orderBy = [{ fechaHora: 'desc' }, { idBitacora: 'desc' }] as const;
type AuditRow = Prisma.BitacoraGetPayload<{ include: typeof include }>;

export function auditDTO(row: AuditRow) {
  const detalle = sanitizeAudit(parseAuditDetail(row.detalle));
  return { ...row, detalle, tipo: auditKind(row.accion), resultado: auditResult(row.accion) };
}

export interface CreateBitacoraInput {
  accion: string;
  entidadAfectada?: string;
  idRegistroAfectado?: bigint | number | string;
  detalle?: string;
  idUsuario?: bigint | number;
}

export class AuditRepository {
  async list(query: AuditQuery) {
    const where = auditWhere(query);
    const [rows, total, rechazados, errores] = await prisma.$transaction([
      prisma.bitacora.findMany({ where, include, orderBy: [...orderBy], skip: (query.pagina - 1) * query.limite, take: query.limite }),
      prisma.bitacora.count({ where }),
      prisma.bitacora.count({ where: { AND: [where, resultWhere('RECHAZADO')] } }),
      prisma.bitacora.count({ where: { AND: [where, resultWhere('ERROR')] } }),
    ], { isolationLevel: 'RepeatableRead' });
    return { eventos: rows.map(auditDTO), total, pagina: query.pagina, limite: query.limite,
      paginas: Math.ceil(total / query.limite), resumen: { exitosos: total - rechazados - errores, rechazados, errores } };
  }

  async detail(idBitacora: bigint) {
    const row = await prisma.bitacora.findUnique({ where: { idBitacora }, include });
    return row ? auditDTO(row) : null;
  }

  async filters() {
    const [actions, entities, actors] = await Promise.all([
      prisma.bitacora.findMany({ distinct: ['accion'], select: { accion: true }, orderBy: { accion: 'asc' }, take: 500 }),
      prisma.bitacora.findMany({ distinct: ['entidadAfectada'], select: { entidadAfectada: true }, orderBy: { entidadAfectada: 'asc' }, take: 500 }),
      prisma.bitacora.findMany({ where: { idUsuario: { not: null } }, distinct: ['idUsuario'], select: { usuario: include.usuario }, orderBy: { idUsuario: 'asc' }, take: 500 }),
    ]);
    return { acciones: actions.map(a => a.accion), entidades: entities.map(e => e.entidadAfectada),
      usuarios: actors.flatMap(a => a.usuario ? [a.usuario] : []).sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto)) };
  }

  async export(query: AuditQuery) {
    const rows = await prisma.bitacora.findMany({ where: auditWhere(query), include, orderBy: [...orderBy], take: 10001 });
    return rows.map(auditDTO);
  }

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
