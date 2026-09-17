import { Router } from "express";
import { authController } from "./auth.controller";
import { requireAuth } from "./auth.middleware";
import { authRateLimiter } from "../../middlewares/rateLimit.middleware";

const router = Router();

// ------------------ Portal publico ------------------
router.post("/register", authRateLimiter, authController.register);
router.post("/login", authRateLimiter, authController.login);
router.post("/refresh", authController.refresh);
router.post("/verify-email", authRateLimiter, authController.verifyEmail);
router.post("/forgot-password", authRateLimiter, authController.forgotPassword);
router.post("/reset-password", authRateLimiter, authController.resetPassword);

// ------------------ Panel administrativo ------------------
// Endpoint independiente del login publico: valida ademas que
// el usuario tenga un rol administrativo.
router.post("/admin/login", authRateLimiter, authController.adminLogin);

// ------------------ Rutas protegidas (cualquier sesion) ------------------
router.post("/logout", requireAuth, authController.logout);
router.get("/me", requireAuth, authController.me);
router.post("/change-password", requireAuth, authController.changePassword);

export default router;
