import crypto from "crypto";
import { EmailVerificationService } from "./email-verification.service";
import { beginLoginVerification, consumeLoginVerification, verifyCaptcha } from "./login-security";
import { ApiError } from "../../utils/apiError";
import { PasswordRecoveryService } from "./password-recovery.service";
import { comparePassword, hashPassword } from "../../utils/password";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  credentialVersion,
} from "../../utils/jwt";
import { UserRepository } from "../users/user.repository";
import {
  ROLES_ADMINISTRATIVOS, rolesActivos,
} from "../roles/role.repository";
import { AuditService, AuditAction } from "../audit/audit.service";
import { AuthRepository } from "./auth.repository";
import {
  AdminLoginInput,
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from "./auth.validation";
import { AuthenticatedUserDTO, TokensDTO } from "./auth.types";


function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

interface RequestMeta {
  userAgent?: string;
  ip?: string;
}

export class AuthService {
  private userRepository = new UserRepository();
  private authRepository = new AuthRepository();
  private auditService = new AuditService();
  private emailVerification = new EmailVerificationService();

  // ---------------------------------------------------------
  // REGISTRO
  // ---------------------------------------------------------
  async registrar(input: RegisterInput, meta: RequestMeta) {
    const existente = await this.userRepository.findByCorreo(input.correo);
    if (existente) {
      throw ApiError.conflict("Ya existe una cuenta con este correo");
    }

    const contrasenaHash = await hashPassword(input.contrasena);

    const usuario = await this.authRepository.crearEstudiante(input, contrasenaHash);
    let correoEnviado = true;
    try {
      await this.emailVerification.solicitar(usuario.correo);
    } catch {
      correoEnviado = false;
    }

    await this.auditService.registrar({
      accion: AuditAction.REGISTRO_USUARIO,
      entidadAfectada: "usuario",
      idRegistroAfectado: usuario.idUsuario,
      detalle: `Registro de usuario ${usuario.correo}`,
      idUsuario: usuario.idUsuario,
    });

    return {
      idUsuario: usuario.idUsuario,
      correo: usuario.correo,
      correoEnviado,
      mensaje: correoEnviado
        ? "Cuenta creada. Confirma tu correo con el codigo temporal para poder ingresar."
        : "Cuenta creada, pero no pudimos enviar el codigo. Usa Reenviar codigo para confirmar tu correo antes de ingresar.",
    };
  }

  // ---------------------------------------------------------
  // LOGIN
  // ---------------------------------------------------------
  async login(input: LoginInput, meta: RequestMeta) {
    verifyCaptcha(input.captchaId, input.captchaCode);
    const usuario = await this.userRepository.findByIdWithRolesByCorreo(
      input.correo
    );

    if (!usuario || !usuario.contrasenaHash) {
      await this.auditService.registrar({
        accion: AuditAction.LOGIN_FALLIDO,
        entidadAfectada: "usuario",
        detalle: `Intento de login con correo inexistente: ${input.correo}`,
      });
      throw ApiError.unauthorized("Credenciales invalidas");
    }

    if (usuario.estado.toUpperCase() !== "ACTIVO") {
      throw ApiError.forbidden("Tu cuenta se encuentra inactiva. Contacta al administrador.");
    }

    const contrasenaValida = await comparePassword(
      input.contrasena,
      usuario.contrasenaHash
    );

    if (!contrasenaValida) {
      await this.auditService.registrar({
        accion: AuditAction.LOGIN_FALLIDO,
        entidadAfectada: "usuario",
        idRegistroAfectado: usuario.idUsuario,
        detalle: "Contrasena incorrecta",
        idUsuario: usuario.idUsuario,
      });
      throw ApiError.unauthorized("Credenciales invalidas");
    }

    if (!usuario.twoFactorEnabled) return this.crearSesion(usuario, false, meta);
    return beginLoginVerification({ ...usuario, contrasenaHash: usuario.contrasenaHash }, false);
  }

  // ---------------------------------------------------------
  // LOGIN ADMINISTRATIVO (/api/auth/admin/login)
  // Reutiliza la misma logica de credenciales que el login
  // publico, pero exige ademas que el usuario tenga alguno de
  // los roles administrativos y registra una accion de
  // auditoria distinta (LOGIN_ADMIN_EXITOSO / LOGIN_ADMIN_FALLIDO).
  // ---------------------------------------------------------
  async loginAdmin(input: AdminLoginInput, meta: RequestMeta) {
    verifyCaptcha(input.captchaId, input.captchaCode);
    const usuario = await this.userRepository.findByIdWithRolesByCorreo(
      input.correo
    );

    if (!usuario || !usuario.contrasenaHash) {
      await this.auditService.registrar({
        accion: AuditAction.LOGIN_ADMIN_FALLIDO,
        entidadAfectada: "usuario",
        detalle: `Intento de login administrativo con correo inexistente: ${input.correo}`,
      });
      throw ApiError.unauthorized("Credenciales invalidas");
    }

    if (usuario.estado.toUpperCase() !== "ACTIVO") {
      throw ApiError.forbidden("Tu cuenta se encuentra inactiva. Contacta al administrador.");
    }

    const contrasenaValida = await comparePassword(
      input.contrasena,
      usuario.contrasenaHash
    );

    if (!contrasenaValida) {
      await this.auditService.registrar({
        accion: AuditAction.LOGIN_ADMIN_FALLIDO,
        entidadAfectada: "usuario",
        idRegistroAfectado: usuario.idUsuario,
        detalle: "Contrasena incorrecta (login administrativo)",
        idUsuario: usuario.idUsuario,
      });
      throw ApiError.unauthorized("Credenciales invalidas");
    }

    const roles = rolesActivos(usuario.roles);
    const esAdministrativo = roles.some((rol) =>
      (ROLES_ADMINISTRATIVOS as readonly string[]).includes(rol)
    );

    if (!esAdministrativo) {
      await this.auditService.registrar({
        accion: AuditAction.LOGIN_ADMIN_FALLIDO,
        entidadAfectada: "usuario",
        idRegistroAfectado: usuario.idUsuario,
        detalle: "Usuario sin rol administrativo intento acceder al panel",
        idUsuario: usuario.idUsuario,
      });
      throw ApiError.forbidden(
        "Tu cuenta no tiene permisos para acceder al panel administrativo"
      );
    }

    if (!usuario.twoFactorEnabled) return this.crearSesion(usuario, true, meta);
    return beginLoginVerification({ ...usuario, contrasenaHash: usuario.contrasenaHash }, true);
  }

  async verificarLogin(input: { challengeId: string; codigo: string }, admin: boolean, meta: RequestMeta): Promise<{
    usuario: AuthenticatedUserDTO; tokens: TokensDTO;
  }> {
    const challenge = consumeLoginVerification(input.challengeId, input.codigo, admin);
    const usuario = await this.userRepository.findByIdWithRoles(BigInt(challenge.idUsuario));
    if (!usuario || usuario.estado.toUpperCase() !== "ACTIVO" ||
        !usuario.twoFactorEnabled || usuario.correo !== challenge.correo || usuario.contrasenaHash !== challenge.passwordHash) {
      throw ApiError.unauthorized("La cuenta cambio. Vuelve a iniciar sesion.");
    }
    return this.crearSesion(usuario, admin, meta);
  }

  private async crearSesion(
    usuario: NonNullable<Awaited<ReturnType<UserRepository["findByIdWithRoles"]>>>,
    admin: boolean, meta: RequestMeta
  ): Promise<{ usuario: AuthenticatedUserDTO; tokens: TokensDTO }> {
    const roles = rolesActivos(usuario.roles);
    if (admin && !roles.some((rol) => (ROLES_ADMINISTRATIVOS as readonly string[]).includes(rol))) {
      throw ApiError.forbidden("Tu cuenta no tiene permisos para acceder al panel administrativo");
    }
    const accessToken = signAccessToken({
      idUsuario: usuario.idUsuario.toString(), correo: usuario.correo, roles, debeCambiarPassword: usuario.debeCambiarPassword,
      credentialVersion: credentialVersion(usuario.contrasenaHash),
    });
    const refreshToken = signRefreshToken({
      idUsuario: usuario.idUsuario.toString(), tokenId: crypto.randomUUID(),
      credentialVersion: credentialVersion(usuario.contrasenaHash),
    });
    await this.authRepository.guardarRefreshToken({
      idUsuario: usuario.idUsuario, tokenHash: hashToken(refreshToken),
      expiraEn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      userAgent: meta.userAgent, ip: meta.ip,
    });
    await this.auditService.registrar({
      accion: admin ? AuditAction.LOGIN_ADMIN_EXITOSO : AuditAction.LOGIN_EXITOSO,
      entidadAfectada: "usuario", idRegistroAfectado: usuario.idUsuario,
      detalle: usuario.twoFactorEnabled ? "Login exitoso con verificacion en dos pasos" : "Login exitoso",
      idUsuario: usuario.idUsuario,
    });
    return {
      usuario: {
        idUsuario: usuario.idUsuario.toString(), nombreCompleto: usuario.nombreCompleto,
        correo: usuario.correo, roles, permisos: usuario.permisos ?? [], correoVerificado: usuario.correoVerificado,
        debeCambiarPassword: usuario.debeCambiarPassword,
      },
      tokens: { accessToken, refreshToken },
    };
  }

  async estadoTwoFactor(idUsuario: bigint) {
    const usuario = await this.userRepository.findById(idUsuario);
    if (!usuario || usuario.estado.toUpperCase() !== "ACTIVO") throw ApiError.unauthorized("Usuario no valido");
    return { enabled: usuario.twoFactorEnabled };
  }

  async solicitarCambioTwoFactor(idUsuario: bigint, input: { contrasena: string; enabled: boolean }) {
    const usuario = await this.userRepository.findById(idUsuario);
    if (!usuario || usuario.estado.toUpperCase() !== "ACTIVO" || !usuario.contrasenaHash ||
        !await comparePassword(input.contrasena, usuario.contrasenaHash)) {
      throw ApiError.badRequest("La contrasena actual es incorrecta");
    }
    if (usuario.twoFactorEnabled === input.enabled) throw ApiError.conflict("La configuracion ya tiene ese estado");
    return beginLoginVerification({ ...usuario, contrasenaHash: usuario.contrasenaHash }, false,
      input.enabled ? "enable" : "disable");
  }

  async confirmarCambioTwoFactor(idUsuario: bigint, input: { challengeId: string; codigo: string; enabled: boolean }) {
    const challenge = consumeLoginVerification(input.challengeId, input.codigo, false,
      input.enabled ? "enable" : "disable", idUsuario.toString());
    await this.authRepository.actualizarTwoFactor(idUsuario, input.enabled, challenge.correo, challenge.passwordHash);
    return { enabled: input.enabled };
  }

  // ---------------------------------------------------------
  // CAMBIO DE CONTRASENA (usuario autenticado)
  // Usado tanto para el cambio voluntario como para el cambio
  // obligatorio de la contrasena temporal del administrador
  // sembrado por el seed.
  // ---------------------------------------------------------
  async cambiarPassword(idUsuario: bigint | number, input: ChangePasswordInput) {
    const usuario = await this.userRepository.findById(idUsuario);
    if (!usuario || !usuario.contrasenaHash) {
      throw ApiError.notFound("Usuario no encontrado");
    }

    if (!usuario.correoVerificado) throw ApiError.forbidden("Confirma tu correo antes de cambiar la contrasena");

    const contrasenaValida = await comparePassword(
      input.contrasenaActual,
      usuario.contrasenaHash
    );

    if (!contrasenaValida) {
      throw ApiError.unauthorized("La contrasena actual es incorrecta");
    }

    if (await comparePassword(input.nuevaContrasena, usuario.contrasenaHash)) {
      throw ApiError.badRequest("La nueva contraseña debe ser diferente de la contraseña actual o temporal");
    }
    const nuevoHash = await hashPassword(input.nuevaContrasena);
    await this.userRepository.actualizarContrasena(idUsuario, nuevoHash, usuario.contrasenaHash);

    await this.auditService.registrar({
      accion: usuario.debeCambiarPassword
        ? AuditAction.CAMBIO_CONTRASENA_INICIAL
        : AuditAction.CAMBIO_CONTRASENA,
      entidadAfectada: "usuario",
      idRegistroAfectado: idUsuario,
      idUsuario,
    });

    return { mensaje: "Contrasena actualizada correctamente" };
  }

  // ---------------------------------------------------------
  // REFRESH TOKEN
  // ---------------------------------------------------------
  async refrescarSesion(refreshToken: string): Promise<TokensDTO> {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw ApiError.unauthorized("Refresh token invalido o expirado");
    }

    const tokenHash = hashToken(refreshToken);
    const registro = await this.authRepository.buscarRefreshTokenPorHash(
      tokenHash
    );

    if (!registro || registro.revocado || registro.expiraEn < new Date()) {
      throw ApiError.unauthorized("Sesion expirada, inicia sesion nuevamente");
    }

    const usuario = await this.userRepository.findByIdWithRoles(BigInt(payload.idUsuario));

    if (!usuario || usuario.estado.toUpperCase() !== "ACTIVO") {
      throw ApiError.unauthorized("Usuario no valido");
    }

    if (payload.credentialVersion !== credentialVersion(usuario.contrasenaHash)) {
      throw ApiError.unauthorized("La contraseña cambió. Inicia sesión nuevamente");
    }

    // Rotacion de refresh token: se revoca el anterior y se emite uno nuevo
    await this.authRepository.revocarRefreshToken(tokenHash);

    const roles = rolesActivos(usuario.roles);

    const nuevoAccessToken = signAccessToken({
      idUsuario: usuario.idUsuario.toString(),
      correo: usuario.correo,
      roles,
      debeCambiarPassword: usuario.debeCambiarPassword,
      credentialVersion: credentialVersion(usuario.contrasenaHash),
    });

    const tokenId = crypto.randomUUID();
    const nuevoRefreshToken = signRefreshToken({
      idUsuario: usuario.idUsuario.toString(),
      tokenId,
      credentialVersion: credentialVersion(usuario.contrasenaHash),
    });

    await this.authRepository.guardarRefreshToken({
      idUsuario: usuario.idUsuario,
      tokenHash: hashToken(nuevoRefreshToken),
      expiraEn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    await this.auditService.registrar({
      accion: AuditAction.REFRESH_TOKEN,
      entidadAfectada: "usuario",
      idRegistroAfectado: usuario.idUsuario,
      idUsuario: usuario.idUsuario,
    });

    return { accessToken: nuevoAccessToken, refreshToken: nuevoRefreshToken };
  }

  // ---------------------------------------------------------
  // LOGOUT
  // ---------------------------------------------------------
  async logout(refreshToken: string | undefined, idUsuario?: bigint | number) {
    if (refreshToken) {
      await this.authRepository.revocarRefreshToken(hashToken(refreshToken));
    }

    await this.auditService.registrar({
      accion: AuditAction.LOGOUT,
      entidadAfectada: "usuario",
      idRegistroAfectado: idUsuario,
      idUsuario,
    });
  }

  // ---------------------------------------------------------
  // VERIFICACION DE CORREO
  // ---------------------------------------------------------
  async verificarCorreo(input: VerifyEmailInput) {
    return this.emailVerification.confirmar(input.correo, input.codigo);
  }

  async reenviarVerificacion(correo: string) {
    return this.emailVerification.solicitar(correo);
  }

  // ---------------------------------------------------------
  // FORGOT PASSWORD
  // ---------------------------------------------------------
  async solicitarRecuperacion(input: ForgotPasswordInput) {
    return new PasswordRecoveryService().solicitar(input.correo);
  }

  async restablecerContrasena(input: ResetPasswordInput) {
    return new PasswordRecoveryService().restablecer(input);
  }
}
