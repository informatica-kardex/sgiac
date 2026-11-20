import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { idSchema } from '../users/user.validation';

const optionalText = (max: number) => z.string().trim().max(max).optional();
export const auditQuerySchema = z.object({
  q: optionalText(150), accion: optionalText(100), entidad: optionalText(100),
  usuario: idSchema.optional(), registro: optionalText(100),
  tipo: z.enum(['ACCESO', 'MODIFICACION', 'CONSULTA', 'EXPORTACION', 'SISTEMA']).optional(),
  resultado: z.enum(['EXITO', 'RECHAZADO', 'ERROR']).optional(),
  desde: z.string().datetime({ offset: true }).optional(),
  hasta: z.string().datetime({ offset: true }).optional(),
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(25),
}).strict().refine(q => !q.desde || !q.hasta || Date.parse(q.desde) < Date.parse(q.hasta),
  'La fecha final debe ser posterior a la inicial');
export type AuditQuery = z.infer<typeof auditQuerySchema>;

export function resultWhere(result: NonNullable<AuditQuery['resultado']>): Prisma.BitacoraWhereInput {
  const rejected: Prisma.BitacoraWhereInput = { OR: [{ accion: { startsWith: 'HTTP_RECHAZADO_' } }, { accion: { contains: 'FALLIDO' } }] };
  const error = { accion: { startsWith: 'HTTP_ERROR_' } };
  return result === 'RECHAZADO' ? rejected : result === 'ERROR' ? error : { NOT: { OR: [rejected, error] } };
}

export function auditWhere(query: AuditQuery): Prisma.BitacoraWhereInput {
  const AND: Prisma.BitacoraWhereInput[] = [];
  if (query.q) AND.push({ OR: [
    ...(['accion', 'entidadAfectada', 'idRegistroAfectado', 'detalle'] as const).map(key => ({ [key]: { contains: query.q, mode: 'insensitive' as const } })),
    { usuario: { is: { OR: [{ nombreCompleto: { contains: query.q, mode: 'insensitive' } }, { correo: { contains: query.q, mode: 'insensitive' } }] } } },
  ] });
  if (query.accion) AND.push({ accion: query.accion });
  if (query.entidad) AND.push({ entidadAfectada: query.entidad });
  if (query.usuario) AND.push({ idUsuario: query.usuario });
  if (query.registro) AND.push({ idRegistroAfectado: query.registro });
  if (query.desde || query.hasta) AND.push({ fechaHora: {
    ...(query.desde ? { gte: new Date(query.desde) } : {}), ...(query.hasta ? { lt: new Date(query.hasta) } : {}),
  } });
  if (query.resultado) AND.push(resultWhere(query.resultado));
  if (query.tipo) {
    const http = { AND: [{ accion: { startsWith: 'HTTP_' } }, { accion: { contains: `_${query.tipo}_` } }] };
    const legacy = query.tipo === 'ACCESO' ? { accion: { startsWith: 'AUTH_' } }
      : query.tipo === 'SISTEMA' ? { accion: { startsWith: 'SEED_' } }
      : query.tipo === 'MODIFICACION' ? { NOT: { OR: ['HTTP_', 'AUTH_', 'SEED_'].map(prefix => ({ accion: { startsWith: prefix } })) } } : null;
    AND.push(legacy ? { OR: [http, legacy] } : http);
  }
  return { AND };
}

export function auditKind(action: string) {
  return action.startsWith('HTTP_') ? action.split('_')[2]
    : action.startsWith('AUTH_') ? 'ACCESO' : action.startsWith('SEED_') ? 'SISTEMA' : 'MODIFICACION';
}
export function auditResult(action: string) {
  return action.startsWith('HTTP_ERROR_') ? 'ERROR' : action.startsWith('HTTP_RECHAZADO_') || action.includes('FALLIDO') ? 'RECHAZADO' : 'EXITO';
}

// Las celdas siempre se entrecomillan y se neutralizan fórmulas de hojas de cálculo.
export function csvCell(value: unknown) {
  const text = String(value ?? '');
  return `"${(/^[\s\u0000-\u001f]*[=+@-]/.test(text) ? "'" + text : text).replace(/"/g, '""')}"`;
}
