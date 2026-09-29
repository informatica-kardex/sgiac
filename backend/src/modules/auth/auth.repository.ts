import { prisma } from "../../database/prisma";

import { RegisterInput } from "./auth.validation";
import { ApiError } from "../../utils/apiError";
import { Prisma } from "@prisma/client";
import { ROL_POR_DEFECTO } from "../roles/role.repository";

export class AuthRepository {
  async actualizarTwoFactor(idUsuario: bigint, enabled: boolean, correo: string, contrasenaHash: string) {
    const result = await prisma.usuario.updateMany({
      where: { idUsuario, correo, contrasenaHash, estado: "ACTIVO", twoFactorEnabled: !enabled },
      data: { twoFactorEnabled: enabled },
    });
    if (result.count !== 1) throw ApiError.conflict("La cuenta cambio. Vuelve a intentarlo.");
  }

  async crearEstudiante(input: RegisterInput, contrasenaHash: string, verificacion?: { codigo: string; expiraEn: Date }) {
    const existente = await prisma.estudiante.findFirst({
      where: { OR: [{ ci: input.ci }, { ru: input.ru }, { correo_institucional: input.correo }] },
    });
    if (existente) {
      const campo = existente.ci === input.ci ? "CI" : existente.ru === input.ru ? "registro universitario (RU)" : "correo institucional";
      throw ApiError.conflict(`Ya existe un estudiante con este ${campo}.`);
    }
    const rol = await prisma.rol.findUnique({ where: { nombre: ROL_POR_DEFECTO } });
    try {
    // Usuario, estudiante, rol y token se guardan juntos o se revierten juntos.
    return await prisma.usuario.create({
      data: {
        nombreCompleto: input.nombres + " " + input.apellidos,
        correo: input.correo,
        contrasenaHash,
        estado: "ACTIVO",
        ...(rol ? { roles: { create: { idRol: rol.idRol } } } : {}),
        ...(verificacion ? { emailVerificationTokens: { create: verificacion } } : {}),
        estudiante: { create: {
          nombres: input.nombres, apellidos: input.apellidos, ci: input.ci,
          ru: input.ru, correo_institucional: input.correo,
          // Reutilizamos la columna existente; no requiere migración de datos.
          carrera: input.mencion,
        } },
      },
    });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const target = Array.isArray(error.meta?.target) ? error.meta.target.join(" ") : String(error.meta?.target ?? "");
        if (/correo/.test(target)) throw ApiError.conflict("Ya existe una cuenta con este correo institucional.");
        if (/(^|\W)ci(\W|$)/.test(target)) throw ApiError.conflict("Ya existe un estudiante con este CI.");
        if (/(^|\W)ru(\W|$)/.test(target)) throw ApiError.conflict("Ya existe un estudiante con este registro universitario (RU).");
        throw ApiError.internal("No se pudo asignar un identificador a la cuenta. El administrador debe revisar las secuencias de la base de datos.");
      }
      throw error;
    }
  }

  // ------------------ Refresh tokens ------------------

  async guardarRefreshToken(data: {
    idUsuario: bigint | number;
    tokenHash: string;
    expiraEn: Date;
    userAgent?: string;
    ip?: string;
  }) {
    return prisma.refreshToken.create({ data });
  }

  async buscarRefreshTokenPorHash(tokenHash: string) {
    return prisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  async revocarRefreshToken(tokenHash: string) {
    return prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { revocado: true },
    });
  }

  async revocarTodosLosRefreshTokens(idUsuario: bigint | number) {
    return prisma.refreshToken.updateMany({
      where: { idUsuario, revocado: false },
      data: { revocado: true },
    });
  }

  // ------------------ Verificacion de correo ------------------

  async crearCodigoVerificacion(idUsuario: bigint | number, codigo: string, expiraEn: Date) {
    return prisma.emailVerificationToken.create({
      data: { idUsuario, codigo, expiraEn },
    });
  }

  async buscarCodigoVerificacionValido(idUsuario: bigint | number, codigo: string) {
    return prisma.emailVerificationToken.findFirst({
      where: {
        idUsuario,
        codigo,
        usado: false,
        expiraEn: { gt: new Date() },
      },
      orderBy: { creadoEn: "desc" },
    });
  }

  async marcarCodigoVerificacionUsado(idToken: number) {
    return prisma.emailVerificationToken.update({
      where: { idToken },
      data: { usado: true },
    });
  }

  // ------------------ Recuperacion de contrasena ------------------

  async crearCodigoReset(idUsuario: bigint | number, codigo: string, expiraEn: Date) {
    return prisma.passwordResetToken.create({
      data: { idUsuario, codigo, expiraEn },
    });
  }

  async buscarCodigoResetValido(idUsuario: bigint | number, codigo: string) {
    return prisma.passwordResetToken.findFirst({
      where: {
        idUsuario,
        codigo,
        usado: false,
        expiraEn: { gt: new Date() },
      },
      orderBy: { creadoEn: "desc" },
    });
  }

  async marcarCodigoResetUsado(idToken: number) {
    return prisma.passwordResetToken.update({
      where: { idToken },
      data: { usado: true },
    });
  }
}
