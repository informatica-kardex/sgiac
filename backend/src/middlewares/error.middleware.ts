import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { MulterError } from "multer";
import { ApiError } from "../utils/apiError";
import { isProduction } from "../config/env";

// Middleware centralizado de manejo de errores.
// Debe registrarse SIEMPRE al final de la cadena de middlewares
// en app.ts (despues de todas las rutas).
export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) {
  if (err instanceof MulterError) {
    return res.status(err.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
      success: false,
      message: err.code === "LIMIT_FILE_SIZE" ? "Cada archivo puede pesar hasta 10 MB" : "Revisa los archivos: se permiten hasta 10 imágenes JPG, PNG o WebP, o un solo PDF",
    });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: "Error de validacion",
      details: err.issues.map((issue) => ({
        campo: issue.path.join("."),
        mensaje: issue.message,
      })),
    });
  }

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      details: err.details,
    });
  }

  // Errores de Prisma conocidos (ej. violacion de unicidad)
  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  ) {
    return res.status(409).json({
      success: false,
      message: "El recurso ya existe (violacion de restriccion unica).",
    });
  }

  console.error("[ERROR NO CONTROLADO]", err);

  return res.status(500).json({
    success: false,
    message: "Error interno del servidor",
    ...(isProduction
      ? {}
      : { stack: err instanceof Error ? err.stack : undefined }),
  });
}

export function notFoundMiddleware(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  });
}
