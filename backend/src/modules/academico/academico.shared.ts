import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { z } from 'zod';

export const idSchema = z.string().regex(/^[1-9]\d{0,17}$/, 'Identificador inválido');
export const codigoSchema = z.string().trim().toUpperCase().min(1).max(30).regex(/^[A-Z0-9][A-Z0-9._-]*$/, 'Usa letras, números, puntos o guiones');
export const LUGARES = ['ANTIGUO', 'PABELLONES', 'LASIN', 'INFORMATICA'] as const;
// Un mismo bloqueo para todas las escrituras académicas: la comprobación de
// choques y la escritura se ejecutan de forma atómica incluso entre procesos.
export function academicTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(20260930, 1)`;
    return fn(tx);
  }, { timeout: 15000 });
}
