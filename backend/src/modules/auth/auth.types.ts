export interface AuthenticatedUserDTO {
  idUsuario: string;
  nombreCompleto: string;
  correo: string;
  roles: string[];
  correoVerificado: boolean;
  debeCambiarPassword: boolean;
}

export interface TokensDTO {
  accessToken: string;
  refreshToken: string;
}
