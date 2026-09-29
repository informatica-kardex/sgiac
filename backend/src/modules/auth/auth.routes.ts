import { Router } from "express";
import { authController } from "./auth.controller";
import { requireAuth } from "./auth.middleware";
import { authRateLimiter, emailVerificationLimiter } from "../../middlewares/rateLimit.middleware";

const router = Router();

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
// Endpoint independiente del login publico: valida ademas que
// el usuario tenga un rol administrativo.
router.post("/admin/login", authRateLimiter, authController.adminLogin);
router.post("/admin/login/verify", authRateLimiter, authController.verifyAdminLogin);

// ------------------ Rutas protegidas (cualquier sesion) ------------------
router.post("/logout", requireAuth, authController.logout);
router.get("/me", requireAuth, authController.me);
router.get("/two-factor", requireAuth, authController.twoFactorStatus);
router.post("/two-factor/setup", requireAuth, authRateLimiter, authController.twoFactorSetup);
router.post("/two-factor/confirm", requireAuth, authRateLimiter, authController.twoFactorConfirm);
router.post("/change-password", requireAuth, authController.changePassword);

export default router;
