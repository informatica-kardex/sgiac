import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { ApiError } from "../../utils/apiError";
import { env } from "../../config/env";
import { AuthService } from "./auth.service";
import {
  adminLoginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "./auth.validation";
import { UserService } from "../users/user.service";

const authService = new AuthService();
const userService = new UserService();

const REFRESH_COOKIE_NAME = "refreshToken";
const ACCESS_COOKIE_NAME = "accessToken";

function cookieOptionsBase() {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: "lax" as const,
  };
}

function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string }
) {
  res.cookie(ACCESS_COOKIE_NAME, tokens.accessToken, {
    ...cookieOptionsBase(),
    maxAge: 15 * 60 * 1000, // 15 minutos
  });
  res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, {
    ...cookieOptionsBase(),
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
  });
}

function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE_NAME, cookieOptionsBase());
  res.clearCookie(REFRESH_COOKIE_NAME, cookieOptionsBase());
}

function getRequestMeta(req: Request) {
  return {
    userAgent: req.headers["user-agent"],
    ip: req.ip,
  };
}

export const authController = {
  register: asyncHandler(async (req, res) => {
    const parsed = registerSchema.parse(req.body);
    const resultado = await authService.registrar(parsed, getRequestMeta(req));
    return sendSuccess(res, resultado, "Registro exitoso", 201);
  }),

  login: asyncHandler(async (req, res) => {
    const parsed = loginSchema.parse(req.body);
    const { usuario, tokens } = await authService.login(
      parsed,
      getRequestMeta(req)
    );
    setAuthCookies(res, tokens);
    return sendSuccess(res, { usuario, ...tokens }, "Inicio de sesion exitoso");
  }),

  adminLogin: asyncHandler(async (req, res) => {
    const parsed = adminLoginSchema.parse(req.body);
    const { usuario, tokens } = await authService.loginAdmin(
      parsed,
      getRequestMeta(req)
    );
    setAuthCookies(res, tokens);
    return sendSuccess(
      res,
      { usuario, ...tokens },
      "Inicio de sesion administrativo exitoso"
    );
  }),

  changePassword: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized("No autenticado");
    }
    const parsed = changePasswordSchema.parse(req.body);
    const resultado = await authService.cambiarPassword(
      BigInt(req.user.idUsuario),
      parsed
    );
    return sendSuccess(res, resultado, "Contrasena actualizada");
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;
    if (!refreshToken) {
      throw ApiError.unauthorized("No se proporciono refresh token");
    }
    const tokens = await authService.refrescarSesion(refreshToken);
    setAuthCookies(res, tokens);
    return sendSuccess(res, tokens, "Sesion renovada");
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;
    await authService.logout(refreshToken, req.user ? BigInt(req.user.idUsuario) : undefined);
    clearAuthCookies(res);
    return sendSuccess(res, null, "Sesion cerrada");
  }),

  verifyEmail: asyncHandler(async (req, res) => {
    const parsed = verifyEmailSchema.parse(req.body);
    const resultado = await authService.verificarCorreo(parsed);
    return sendSuccess(res, resultado, "Correo verificado");
  }),

  forgotPassword: asyncHandler(async (req, res) => {
    const parsed = forgotPasswordSchema.parse(req.body);
    const resultado = await authService.solicitarRecuperacion(parsed);
    return sendSuccess(res, resultado, "Solicitud procesada");
  }),

  resetPassword: asyncHandler(async (req, res) => {
    const parsed = resetPasswordSchema.parse(req.body);
    const resultado = await authService.restablecerContrasena(parsed);
    return sendSuccess(res, resultado, "Contrasena restablecida");
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized("No autenticado");
    }
    const perfil = await userService.obtenerPerfil(BigInt(req.user.idUsuario));
    return sendSuccess(res, perfil, "Perfil obtenido");
  }),
};
