import crypto from "crypto";
import { ApiError } from "../../utils/apiError";
import { comparePassword, generateNumericCode, hashPassword } from "../../utils/password";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../utils/jwt";
import { UserRepository } from "../users/user.repository";
import {
  RoleRepository,
  ROL_POR_DEFECTO,
  ROLES_ADMINISTRATIVOS,
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

const CODIGO_EXPIRACION_MINUTOS = 15;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

interface RequestMeta {
  userAgent?: string;
  ip?: string;
}

export class AuthService {
  private userRepository = new UserRepository();
  private roleRepository = new RoleRepository();
  private authRepository = new AuthRepository();
  private auditService = new AuditService();

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

    // Asignar rol por defecto (Consulta interna). Si el rol no
    // existe todavia en la tabla "rol", se omite silenciosamente
    // y debe crearse manualmente / via seed.
    const rolDefecto = await this.roleRepository.findByNombre(ROL_POR_DEFECTO);
    if (rolDefecto) {
      await this.roleRepository.asignarRolAUsuario(
        usuario.idUsuario,
        rolDefecto.idRol
      );
    }

    // Generar codigo de verificacion de correo
    const codigo = generateNumericCode();
    const expiraEn = new Date(Date.now() + CODIGO_EXPIRACION_MINUTOS * 60000);
    await this.authRepository.crearCodigoVerificacion(
      usuario.idUsuario,
      codigo,
      expiraEn
    );

    // TODO: integrar proveedor de correo (Resend / SendGrid / SMTP)
    // para enviar `codigo` al correo del usuario. Por ahora se
    // deja registrado en consola para entornos de desarrollo.
    console.log(`[DEV] Codigo de verificacion para ${usuario.correo}: ${codigo}`);

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
      mensaje:
        "Cuenta creada correctamente. Revisa tu correo para verificar tu cuenta.",
    };
  }

  // ---------------------------------------------------------
  // LOGIN
  // ---------------------------------------------------------
  async login(input: LoginInput, meta: RequestMeta): Promise<{
    usuario: AuthenticatedUserDTO;
    tokens: TokensDTO;
  }> {
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

    if (usuario.estado !== "ACTIVO") {
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

    const roles = usuario.roles.map((r) => r.rol.nombre);

    const accessToken = signAccessToken({
      idUsuario: usuario.idUsuario.toString(),
      correo: usuario.correo,
      roles,
    });

    const tokenId = crypto.randomUUID();
    const refreshToken = signRefreshToken({
      idUsuario: usuario.idUsuario.toString(),
      tokenId,
    });

    const refreshExpiraEn = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.authRepository.guardarRefreshToken({
      idUsuario: usuario.idUsuario,
      tokenHash: hashToken(refreshToken),
      expiraEn: refreshExpiraEn,
      userAgent: meta.userAgent,
      ip: meta.ip,
    });

    await this.auditService.registrar({
      accion: AuditAction.LOGIN_EXITOSO,
      entidadAfectada: "usuario",
      idRegistroAfectado: usuario.idUsuario,
      detalle: `Login exitoso: ${usuario.correo}`,
      idUsuario: usuario.idUsuario,
    });

    return {
      usuario: {
        idUsuario: usuario.idUsuario.toString(),
        nombreCompleto: usuario.nombreCompleto,
        correo: usuario.correo,
        roles,
        correoVerificado: usuario.correoVerificado,
        debeCambiarPassword: usuario.debeCambiarPassword,
      },
      tokens: { accessToken, refreshToken },
    };
  }

  // ---------------------------------------------------------
  // LOGIN ADMINISTRATIVO (/api/auth/admin/login)
  // Reutiliza la misma logica de credenciales que el login
  // publico, pero exige ademas que el usuario tenga alguno de
  // los roles administrativos y registra una accion de
  // auditoria distinta (LOGIN_ADMIN_EXITOSO / LOGIN_ADMIN_FALLIDO).
  // ---------------------------------------------------------
  async loginAdmin(input: AdminLoginInput, meta: RequestMeta): Promise<{
    usuario: AuthenticatedUserDTO;
    tokens: TokensDTO;
  }> {
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

    if (usuario.estado !== "ACTIVO") {
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

    const roles = usuario.roles.map((r) => r.rol.nombre);
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

    const accessToken = signAccessToken({
      idUsuario: usuario.idUsuario.toString(),
      correo: usuario.correo,
      roles,
    });

    const tokenId = crypto.randomUUID();
    const refreshToken = signRefreshToken({
      idUsuario: usuario.idUsuario.toString(),
      tokenId,
    });

    await this.authRepository.guardarRefreshToken({
      idUsuario: usuario.idUsuario,
      tokenHash: hashToken(refreshToken),
      expiraEn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      userAgent: meta.userAgent,
      ip: meta.ip,
    });

    await this.auditService.registrar({
      accion: AuditAction.LOGIN_ADMIN_EXITOSO,
      entidadAfectada: "usuario",
      idRegistroAfectado: usuario.idUsuario,
      detalle: `Login administrativo exitoso: ${usuario.correo}`,
      idUsuario: usuario.idUsuario,
    });

    return {
      usuario: {
        idUsuario: usuario.idUsuario.toString(),
        nombreCompleto: usuario.nombreCompleto,
        correo: usuario.correo,
        roles,
        correoVerificado: usuario.correoVerificado,
        debeCambiarPassword: usuario.debeCambiarPassword,
      },
      tokens: { accessToken, refreshToken },
    };
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

    const contrasenaValida = await comparePassword(
      input.contrasenaActual,
      usuario.contrasenaHash
    );

    if (!contrasenaValida) {
      throw ApiError.unauthorized("La contrasena actual es incorrecta");
    }

    const nuevoHash = await hashPassword(input.nuevaContrasena);
    await this.userRepository.actualizarContrasena(idUsuario, nuevoHash);
    await this.authRepository.revocarTodosLosRefreshTokens(idUsuario);

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

    if (!usuario || usuario.estado !== "ACTIVO") {
      throw ApiError.unauthorized("Usuario no valido");
    }

    // Rotacion de refresh token: se revoca el anterior y se emite uno nuevo
    await this.authRepository.revocarRefreshToken(tokenHash);

    const roles = usuario.roles.map((r) => r.rol.nombre);

    const nuevoAccessToken = signAccessToken({
      idUsuario: usuario.idUsuario.toString(),
      correo: usuario.correo,
      roles,
    });

    const tokenId = crypto.randomUUID();
    const nuevoRefreshToken = signRefreshToken({
      idUsuario: usuario.idUsuario.toString(),
      tokenId,
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
    const usuario = await this.userRepository.findByCorreo(input.correo);
    if (!usuario) {
      throw ApiError.notFound("Usuario no encontrado");
    }

    const codigoValido = await this.authRepository.buscarCodigoVerificacionValido(
      usuario.idUsuario,
      input.codigo
    );

    if (!codigoValido) {
      throw ApiError.badRequest("Codigo invalido o expirado");
    }

    await this.authRepository.marcarCodigoVerificacionUsado(codigoValido.idToken);
    await this.userRepository.marcarCorreoVerificado(usuario.idUsuario);

    await this.auditService.registrar({
      accion: AuditAction.VERIFICACION_CORREO,
      entidadAfectada: "usuario",
      idRegistroAfectado: usuario.idUsuario,
      idUsuario: usuario.idUsuario,
    });

    return { mensaje: "Correo verificado correctamente" };
  }

  // ---------------------------------------------------------
  // FORGOT PASSWORD
  // ---------------------------------------------------------
  async solicitarRecuperacion(input: ForgotPasswordInput) {
    const usuario = await this.userRepository.findByCorreo(input.correo);

    // Por seguridad, no se revela si el correo existe o no.
    if (!usuario) {
      return {
        mensaje:
          "Si el correo existe en nuestro sistema, recibiras un codigo de recuperacion.",
      };
    }

    const codigo = generateNumericCode();
    const expiraEn = new Date(Date.now() + CODIGO_EXPIRACION_MINUTOS * 60000);
    await this.authRepository.crearCodigoReset(usuario.idUsuario, codigo, expiraEn);

    // TODO: integrar proveedor de correo real
    console.log(`[DEV] Codigo de recuperacion para ${usuario.correo}: ${codigo}`);

    await this.auditService.registrar({
      accion: AuditAction.SOLICITUD_RESET_PASSWORD,
      entidadAfectada: "usuario",
      idRegistroAfectado: usuario.idUsuario,
      idUsuario: usuario.idUsuario,
    });

    return {
      mensaje:
        "Si el correo existe en nuestro sistema, recibiras un codigo de recuperacion.",
    };
  }

  // ---------------------------------------------------------
  // RESET PASSWORD
  // ---------------------------------------------------------
  async restablecerContrasena(input: ResetPasswordInput) {
    const usuario = await this.userRepository.findByCorreo(input.correo);
    if (!usuario) {
      throw ApiError.badRequest("Codigo invalido o expirado");
    }

    const codigoValido = await this.authRepository.buscarCodigoResetValido(
      usuario.idUsuario,
      input.codigo
    );

    if (!codigoValido) {
      throw ApiError.badRequest("Codigo invalido o expirado");
    }

    const nuevaContrasenaHash = await hashPassword(input.nuevaContrasena);
    await this.userRepository.actualizarContrasena(
      usuario.idUsuario,
      nuevaContrasenaHash
    );
    await this.authRepository.marcarCodigoResetUsado(codigoValido.idToken);

    // Invalida todas las sesiones activas por seguridad
    await this.authRepository.revocarTodosLosRefreshTokens(usuario.idUsuario);

    await this.auditService.registrar({
      accion: AuditAction.CAMBIO_CONTRASENA,
      entidadAfectada: "usuario",
      idRegistroAfectado: usuario.idUsuario,
      idUsuario: usuario.idUsuario,
    });

    return { mensaje: "Contrasena actualizada correctamente" };
  }
}
