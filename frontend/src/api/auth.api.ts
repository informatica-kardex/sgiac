import { axiosClient } from "./axiosClient";
import { ApiEnvelope, AuthResponse, UsuarioSesion } from "./types";

export interface RegisterPayload {
  nombres: string;
  apellidos: string;
  ci: string;
  ru: string;
  mencion: string;
  correo: string;
  contrasena: string;
  confirmarContrasena: string;
}

export interface LoginPayload {
  correo: string;
  contrasena: string;
  captchaId: string;
  captchaCode: string;
}

export interface LoginChallenge {
  requiresTwoFactor: true;
  challengeId: string;
  maskedEmail: string;
  expiresIn: number;
}

export interface VerifyLoginPayload {
  challengeId: string;
  codigo: string;
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
    axiosClient.post<ApiEnvelope<{ idUsuario: string; correo: string; mensaje: string; correoEnviado: boolean }>>(
      "/auth/register",
      payload
    ),

  login: (payload: LoginPayload) =>
    axiosClient.post<ApiEnvelope<LoginChallenge | AuthResponse>>("/auth/login", payload),

  captcha: () =>
    axiosClient.get<ApiEnvelope<{ captchaId: string; image: string }>>("/auth/login/captcha"),

  verifyLogin: (payload: VerifyLoginPayload) =>
    axiosClient.post<ApiEnvelope<AuthResponse>>("/auth/login/verify", payload),

  verifyAdminLogin: (payload: VerifyLoginPayload) =>
    axiosClient.post<ApiEnvelope<AuthResponse>>("/auth/admin/login/verify", payload),

  verifyEmail: (payload: VerifyEmailPayload) =>
    axiosClient.post<ApiEnvelope<{ mensaje: string }>>("/auth/verify-email", payload),

  resendVerification: (correo: string) =>
    axiosClient.post<ApiEnvelope<{ mensaje: string; reenviarEn: number }>>("/auth/resend-verification", { correo }),

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
    axiosClient.post<ApiEnvelope<LoginChallenge | AuthResponse>>("/auth/admin/login", payload),

  twoFactorStatus: () => axiosClient.get<ApiEnvelope<{ enabled: boolean }>>("/auth/two-factor"),

  setupTwoFactor: (payload: { contrasena: string; enabled: boolean }) =>
    axiosClient.post<ApiEnvelope<LoginChallenge>>("/auth/two-factor/setup", payload),

  confirmTwoFactor: (payload: VerifyLoginPayload & { enabled: boolean }) =>
    axiosClient.post<ApiEnvelope<{ enabled: boolean }>>("/auth/two-factor/confirm", payload),

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
