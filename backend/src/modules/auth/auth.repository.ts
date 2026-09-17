import { prisma } from "../../database/prisma";

import { RegisterInput } from "./auth.validation";
import { ApiError } from "../../utils/apiError";

export class AuthRepository {
  async crearEstudiante(input: RegisterInput, contrasenaHash: string) {
    const existente = await prisma.estudiante.findFirst({
      where: { OR: [{ ci: input.ci }, { ru: input.ru }, { correo_institucional: input.correo }] },
    });
    if (existente) throw ApiError.conflict("Ya existe un estudiante con este CI, RU o correo institucional");
    return prisma.usuario.create({
      data: {
        nombreCompleto: input.nombres + " " + input.apellidos,
        correo: input.correo,
        contrasenaHash,
        estado: "ACTIVO",
        estudiante: { create: {
          nombres: input.nombres, apellidos: input.apellidos, ci: input.ci,
          ru: input.ru, correo_institucional: input.correo,
          carrera: input.carrera, semestre: input.semestre, gestion: input.gestion,
        } },
      },
    });
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
