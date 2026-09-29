import { createHash } from "crypto";
import { prisma } from "../../database/prisma";
import { ApiError } from "../../utils/apiError";
import { generateNumericCode, hashPassword } from "../../utils/password";
import { sendMail } from "../../utils/mail";
import { academicCodeMail } from "../../utils/mail-template";
import { ROLES_ADMINISTRATIVOS } from "../roles/role.repository";

const hashCode = (code: string) => createHash("sha256").update(code).digest("hex");
const include = { estudiante: true, roles: { include: { rol: true } } } as const;
function eligible(user: { estado: string; estudiante: unknown; roles: { rol: { nombre: string } }[] } | null) {
  return user && user.estado.toUpperCase() === "ACTIVO" && user.estudiante &&
    !user.roles.some(({ rol }) => (ROLES_ADMINISTRATIVOS as readonly string[]).includes(rol.nombre));
}

export class PasswordRecoveryService {
  async solicitar(correo: string) {
    const response = { mensaje: "Si el correo corresponde a una cuenta estudiantil activa, recibirás un código de recuperación.", reenviarEn: 60 };
    const user = await prisma.usuario.findUnique({ where: { correo }, include });
    if (!eligible(user) || !user) return response;
    const code = generateNumericCode();
    const token = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id_usuario FROM usuario WHERE id_usuario = ${user.idUsuario} FOR UPDATE`;
      if (!eligible(await tx.usuario.findUnique({ where: { idUsuario: user.idUsuario }, include }))) return null;
      const last = await tx.passwordResetToken.findFirst({ where: { idUsuario: user.idUsuario, usado: false }, orderBy: { creadoEn: "desc" } });
      if (last && Date.now() - last.creadoEn.getTime() < 60_000) return null;
      await tx.passwordResetToken.updateMany({ where: { idUsuario: user.idUsuario, usado: false }, data: { usado: true } });
      return tx.passwordResetToken.create({ data: { idUsuario: user.idUsuario, codigo: hashCode(code), expiraEn: new Date(Date.now() + 15 * 60_000) } });
    });
    if (!token) return response;
    try {
      await sendMail({ to: correo, subject: "SGIAC: recupera tu contraseña",
        ...academicCodeMail({ name: user.nombreCompleto, title: "Recupera el acceso a tu cuenta",
          description: "Recibimos una solicitud para restablecer tu contraseña de estudiante. Usa este código y elige una nueva contraseña en el sistema.", code, minutes: 15 }),
      });
    } catch (error) {
      await prisma.passwordResetToken.update({ where: { idToken: token.idToken }, data: { usado: true } });
      throw error;
    }
    return response;
  }

  async restablecer(input: { correo: string; codigo: string; nuevaContrasena: string }) {
    const user = await prisma.usuario.findUnique({ where: { correo: input.correo }, include });
    const invalid = () => ApiError.badRequest("Código inválido o expirado. Solicita uno nuevo si es necesario.");
    if (!user || !eligible(user)) throw invalid();
    // Calcular fuera del bloqueo; el código se consume junto con el cambio en la transacción.
    const contrasenaHash = await hashPassword(input.nuevaContrasena);
    return prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id_usuario FROM usuario WHERE id_usuario = ${user.idUsuario} FOR UPDATE`;
      const current = await tx.usuario.findUnique({ where: { idUsuario: user.idUsuario }, include });
      if (!eligible(current) || current?.correo !== input.correo) throw invalid();
      const token = await tx.passwordResetToken.findFirst({ where: {
        idUsuario: user.idUsuario, codigo: hashCode(input.codigo), usado: false, expiraEn: { gt: new Date() },
      } });
      if (!token) throw invalid();
      await tx.passwordResetToken.updateMany({ where: { idUsuario: user.idUsuario, usado: false }, data: { usado: true } });
      // El código de recuperación también demuestra que el estudiante controla su correo.
      await tx.usuario.update({ where: { idUsuario: user.idUsuario }, data: { contrasenaHash, debeCambiarPassword: false, correoVerificado: true } });
      await tx.emailVerificationToken.updateMany({ where: { idUsuario: user.idUsuario, usado: false }, data: { usado: true } });
      await tx.refreshToken.updateMany({ where: { idUsuario: user.idUsuario, revocado: false }, data: { revocado: true } });
      await tx.bitacora.create({ data: { accion: "AUTH_RECUPERACION_PASSWORD", entidadAfectada: "usuario", idRegistroAfectado: user.idUsuario.toString(), idUsuario: user.idUsuario } });
      return { mensaje: "Contraseña actualizada. Inicia sesión con tu nueva contraseña." };
    });
  }
}
