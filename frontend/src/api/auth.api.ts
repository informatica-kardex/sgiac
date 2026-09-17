import { axiosClient } from "./axiosClient";
import { ApiEnvelope, AuthResponse, UsuarioSesion } from "./types";

export interface RegisterPayload {
  nombres: string;
  apellidos: string;
  ci: string;
  ru: string;
  carrera: string;
  semestre: number;
  gestion: number;
  correo: string;
  contrasena: string;
  confirmarContrasena: string;
}

export interface LoginPayload {
  correo: string;
  contrasena: string;
}

export interface ForgotPasswordPayload {
  correo: string;
}

export interface ResetPasswordPayload {
  correo: string;
  codigo: string;
  nuevaContrasena: string;
}

export interface VerifyEmailPayload {
  correo: string;
  codigo: string;
}

export interface ChangePasswordPayload {
  contrasenaActual: string;
  nuevaContrasena: string;
  confirmarContrasena: string;
}

export const authApi = {
  // Portal publico
  register: (payload: RegisterPayload) =>
    axiosClient.post<ApiEnvelope<{ idUsuario: string; correo: string; mensaje: string }>>(
      "/auth/register",
      payload
    ),

  login: (payload: LoginPayload) =>
    axiosClient.post<ApiEnvelope<AuthResponse>>("/auth/login", payload),

  verifyEmail: (payload: VerifyEmailPayload) =>
    axiosClient.post<ApiEnvelope<{ mensaje: string }>>("/auth/verify-email", payload),

  forgotPassword: (payload: ForgotPasswordPayload) =>
    axiosClient.post<ApiEnvelope<{ mensaje: string }>>(
      "/auth/forgot-password",
      payload
    ),

  resetPassword: (payload: ResetPasswordPayload) =>
    axiosClient.post<ApiEnvelope<{ mensaje: string }>>(
      "/auth/reset-password",
      payload
    ),

  // Panel administrativo
  adminLogin: (payload: LoginPayload) =>
    axiosClient.post<ApiEnvelope<AuthResponse>>("/auth/admin/login", payload),

  changePassword: (payload: ChangePasswordPayload) =>
    axiosClient.post<ApiEnvelope<{ mensaje: string }>>(
      "/auth/change-password",
      payload
    ),

  // Compartidas (requieren sesion)
  logout: () => axiosClient.post<ApiEnvelope<null>>("/auth/logout"),

  refresh: () =>
    axiosClient.post<ApiEnvelope<{ accessToken: string; refreshToken: string }>>(
      "/auth/refresh"
    ),

  me: () => axiosClient.get<ApiEnvelope<UsuarioSesion>>("/auth/me"),
};
