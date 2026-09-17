import { AuditRepository, CreateBitacoraInput } from "./audit.repository";

// Acciones estandarizadas registradas en bitacora para el
// modulo de autenticacion. Los futuros modulos deberian seguir
// el mismo patron: "<MODULO>_<ACCION>".
export const AuditAction = {
  LOGIN_EXITOSO: "AUTH_LOGIN_EXITOSO",
  LOGIN_FALLIDO: "AUTH_LOGIN_FALLIDO",
  LOGIN_ADMIN_EXITOSO: "AUTH_LOGIN_ADMIN_EXITOSO",
  LOGIN_ADMIN_FALLIDO: "AUTH_LOGIN_ADMIN_FALLIDO",
  REGISTRO_USUARIO: "AUTH_REGISTRO_USUARIO",
  CAMBIO_CONTRASENA: "AUTH_CAMBIO_CONTRASENA",
  CAMBIO_CONTRASENA_INICIAL: "AUTH_CAMBIO_CONTRASENA_INICIAL",
  LOGOUT: "AUTH_LOGOUT",
  REFRESH_TOKEN: "AUTH_REFRESH_TOKEN",
  SOLICITUD_RESET_PASSWORD: "AUTH_SOLICITUD_RESET_PASSWORD",
  VERIFICACION_CORREO: "AUTH_VERIFICACION_CORREO",
  SEED_ADMIN_CREADO: "SEED_ADMIN_CREADO",
} as const;

export class AuditService {
  private repository = new AuditRepository();

  async registrar(input: CreateBitacoraInput) {
    // La auditoria nunca debe romper el flujo principal: si
    // falla el registro de bitacora, solo se loguea el error.
    try {
      return await this.repository.create(input);
    } catch (error) {
      console.error("[AUDITORIA] Error al registrar bitacora:", error);
      return null;
    }
  }
}
