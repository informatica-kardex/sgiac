import { Permiso } from "../roles/permissions";
export interface AuthenticatedUserDTO {
  idUsuario: string;
  nombreCompleto: string;
  correo: string;
  roles: string[];
  permisos: Permiso[];
  correoVerificado: boolean;
  debeCambiarPassword: boolean;
}

export interface TokensDTO {
  accessToken: string;
  refreshToken: string;
}
