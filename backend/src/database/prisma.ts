import { PrismaClient } from "@prisma/client";
import { isProduction } from "../config/env";

// Patron singleton para evitar multiples instancias de PrismaClient
// en entornos con hot-reload (nodemon / ts-node).
declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

export const prisma =
  global.__prisma__ ??
  new PrismaClient({
    log: isProduction ? ["error", "warn"] : ["error", "warn", "info"],
  });

if (!isProduction) {
  global.__prisma__ = prisma;
}

export default prisma;
