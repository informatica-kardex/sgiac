import { Router } from "express";
import { authController } from "./auth.controller";
import { requireAuth } from "./auth.middleware";
import { authRateLimiter, emailVerificationLimiter } from "../../middlewares/rateLimit.middleware";
import { env } from "../../config/env";
import { ApiError } from "../../utils/apiError";

const router = Router();

router.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET" && req.headers.origin && req.headers.origin !== new URL(env.frontendUrl).origin) {
    return next(ApiError.forbidden("Origen de solicitud no permitido"));
  }
  next();
});

// ------------------ Portal publico ------------------
router.post("/register", authRateLimiter, authController.register);
router.post("/login", authRateLimiter, authController.login);
router.get("/login/captcha", authController.captcha);
router.post("/login/verify", authRateLimiter, authController.verifyLogin);
router.post("/refresh", authController.refresh);
router.post("/verify-email", authRateLimiter, emailVerificationLimiter, authController.verifyEmail);
router.post("/resend-verification", authRateLimiter, authController.resendVerification);
router.post("/forgot-password", authRateLimiter, authController.forgotPassword);
router.post("/reset-password", authRateLimiter, emailVerificationLimiter, authController.resetPassword);

// ------------------ Panel administrativo ------------------
// Alias para clientes anteriores; comparte la lógica del ingreso unificado.
router.post("/admin/login", authRateLimiter, authController.adminLogin);
router.post("/admin/login/verify", authRateLimiter, authController.verifyAdminLogin);

// ------------------ Rutas protegidas (cualquier sesion) ------------------
// Permite borrar cookies y revocar la sesión incluso después de vencer el access token.
router.post("/logout", authController.logout);
router.post("/activity", requireAuth, authController.activity);
router.get("/me", requireAuth, authController.me);
router.patch("/profile", requireAuth, authController.updateProfile);
router.get("/two-factor", requireAuth, authController.twoFactorStatus);
router.post("/two-factor/setup", requireAuth, authRateLimiter, authController.twoFactorSetup);
router.post("/two-factor/confirm", requireAuth, authRateLimiter, authController.twoFactorConfirm);
router.post("/change-password", requireAuth, authController.changePassword);

export default router;
