import { createHash } from "crypto";
import { prisma } from "../../database/prisma";
import { ApiError } from "../../utils/apiError";
import { generateNumericCode } from "../../utils/password";
import { sendMail } from "../../utils/mail";
import { academicCodeMail } from "../../utils/mail-template";

const EXPIRACION_MS = 15 * 60 * 1000;
const REENVIO_MS = 60 * 1000;
export const hashEmailCode = (codigo: string) => createHash("sha256").update(codigo).digest("hex");

export class EmailVerificationService {
  async solicitar(correo: string) {
    const respuesta = { mensaje: "Si tu cuenta está pendiente de verificación, recibirás un código. Revisa también la carpeta de spam.", reenviarEn: 60 };
    const usuario = await prisma.usuario.findUnique({ where: { correo } });
    if (!usuario || usuario.correoVerificado || usuario.estado.toUpperCase() !== "ACTIVO") return respuesta;
    const codigo = generateNumericCode();
    const token = await prisma.$transaction(async tx => {
      // Serializa reenvíos de la misma cuenta para mantener un único código vigente.
      await tx.$queryRaw`SELECT id_usuario FROM usuario WHERE id_usuario = ${usuario.idUsuario} FOR UPDATE`;
      const ultimo = await tx.emailVerificationToken.findFirst({
        where: { idUsuario: usuario.idUsuario, usado: false }, orderBy: { creadoEn: "desc" },
      });
      if (ultimo && Date.now() - ultimo.creadoEn.getTime() < REENVIO_MS) return null;
      await tx.emailVerificationToken.updateMany({ where: { idUsuario: usuario.idUsuario, usado: false }, data: { usado: true } });
      return tx.emailVerificationToken.create({ data: {
        idUsuario: usuario.idUsuario, codigo: hashEmailCode(codigo), expiraEn: new Date(Date.now() + EXPIRACION_MS),
      } });
    });
    if (!token) return respuesta;
    try {
      await sendMail({ to: correo, subject: "SGIAC: confirma tu correo electrónico",
        ...academicCodeMail({ title: "Confirma tu correo electrónico", name: usuario.nombreCompleto,
          description: "Estás a un paso de acceder a los servicios de Kardex. Confirma que este correo te pertenece. Este código no reemplaza tu contraseña.", code: codigo, minutes: 15 }),
      });
    } catch (error) {
      // No dejar un código que no se pudo enviar bloqueando el reintento.
      await prisma.emailVerificationToken.update({ where: { idToken: token.idToken }, data: { usado: true } });
      throw error;
    }
    return respuesta;
  }

  async confirmar(correo: string, codigo: string) {
    const usuario = await prisma.usuario.findUnique({ where: { correo } });
    if (!usuario || usuario.estado.toUpperCase() !== "ACTIVO") throw ApiError.badRequest("Código inválido o expirado");
    return prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id_usuario FROM usuario WHERE id_usuario = ${usuario.idUsuario} FOR UPDATE`;
      const token = await tx.emailVerificationToken.findFirst({
        where: { idUsuario: usuario.idUsuario, codigo: hashEmailCode(codigo), usado: false, expiraEn: { gt: new Date() } },
        orderBy: { creadoEn: "desc" },
      });
      if (!token) throw ApiError.badRequest("Código inválido o expirado. Solicita uno nuevo si es necesario");
      await tx.emailVerificationToken.updateMany({ where: { idUsuario: usuario.idUsuario, usado: false }, data: { usado: true } });
      await tx.usuario.update({ where: { idUsuario: usuario.idUsuario }, data: { correoVerificado: true } });
      await tx.bitacora.create({ data: { accion: "AUTH_VERIFICACION_CORREO", entidadAfectada: "usuario",
        idRegistroAfectado: usuario.idUsuario.toString(), idUsuario: usuario.idUsuario } });
      return { mensaje: "Correo verificado correctamente" };
    });
  }
}
