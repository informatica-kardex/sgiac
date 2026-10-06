import { Router } from "express";
import { fichaController as c } from "./ficha.controller";
import { requireAuth, requirePermission } from "../../middlewares/auth.middleware";
import { atencionPollingLimiter, tableroPollingLimiter } from "../../middlewares/rateLimit.middleware";
import { tvService, tvConfigInput, uploadTV } from "./tv.service";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { ApiError } from "../../utils/apiError";
import { z } from "zod";

const router = Router();
router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
router.get("/tablero", tableroPollingLimiter, c.tablero);
router.get("/tv/archivos/:id", asyncHandler(async (req, res, next) => {
  const file = await tvService.archivo(z.string().uuid().parse(req.params.id));
  // Son archivos públicos del visor. Frontend y API pueden usar puertos o dominios distintos.
  // Helmet establece same-origin por defecto y bloquea <img>/<video> incluso con HTTP 200.
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.type(file.mime).sendFile(file.ruta, error => {
    if (!error) return;
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return next(ApiError.notFound("Archivo no encontrado"));
    next(error);
  });
}));
router.use(requireAuth, requirePermission("fichas"));
router.get("/tv/config", atencionPollingLimiter, asyncHandler(async (_req, res) => sendSuccess(res, await tvService.obtener())));
router.put("/tv/config", asyncHandler(async (req, res) => sendSuccess(res, await tvService.actualizar(tvConfigInput.parse(req.body).voz))));
router.post("/tv/actualizar", asyncHandler(async (_req, res) => sendSuccess(res, await tvService.comando())));
router.post("/tv/probar-voz", asyncHandler(async (_req, res) => sendSuccess(res, await tvService.comando(true))));
router.post("/tv/archivos", (req, res, next) => uploadTV(req, res, error => {
  if (error) return next(ApiError.badRequest("Adjunta un archivo PNG, JPG, WebP, MP4 o WebM de hasta 100 MB."));
  next();
}), asyncHandler(async (req, res) => sendSuccess(res, await tvService.agregar(req.file), "Archivo publicado en TV", 201)));
router.delete("/tv/archivos/:id", asyncHandler(async (req, res) => sendSuccess(res, await tvService.eliminar(z.string().uuid().parse(req.params.id)), "Archivo retirado de TV")));
router.get("/panel", atencionPollingLimiter, c.panel);
router.get("/tramites", c.tramites);
router.post("/tramites", c.crearTramite);
router.put("/tramites/:id", c.editarTramite);
router.delete("/tramites/:id", c.borrarTramite);
router.get("/jornadas", c.jornadas);
router.post("/jornadas", c.crearJornada);
router.put("/jornadas/:id", c.editarJornada);
router.post("/jornadas/:id/siguiente", c.siguiente);
router.get("/", c.listar);
router.post("/:id/accion", c.accion);
export default router;
