import { PrismaClient } from "@prisma/client";
import { isProduction } from "../config/env";
import { enrichAuditData } from '../modules/audit/audit.context';

// Patron singleton para evitar multiples instancias de PrismaClient
// en entornos con hot-reload (nodemon / ts-node).
declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
  var __auditPrisma__: PrismaClient | undefined;
}

export const prisma =
  global.__prisma__ ??
  new PrismaClient({
    log: isProduction ? ["error", "warn"] : ["error", "warn", "info"],
  });

if (global.__auditPrisma__ !== prisma) {
  prisma.$use(async (params, next) => {
    if (params.model === 'Bitacora' && ['create', 'createMany'].includes(params.action)) {
      const rows = Array.isArray(params.args.data) ? params.args.data : [params.args.data];
      rows.forEach(enrichAuditData);
    }
    return next(params);
  });
  global.__auditPrisma__ = prisma;
}

if (!isProduction) {
  global.__prisma__ = prisma;
}

export default prisma;
