import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { env, isProduction } from "./config/env";
import routes from "./routes";
import { errorMiddleware, notFoundMiddleware } from "./middlewares/error.middleware";
import { globalRateLimiter } from "./middlewares/rateLimit.middleware";

const app = express();

// Seguridad HTTP headers
app.use(helmet());

// CORS: solo se permite el origen del frontend configurado,
// con soporte de credenciales (cookies httpOnly).
app.use(
  cors({
    origin: env.frontendUrl,
    credentials: true,
  })
);

// Parseo de body y cookies
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Logging de requests
app.use(morgan(isProduction ? "combined" : "dev"));

// Rate limiting global
app.use(globalRateLimiter);

// Rutas de la API
app.use("/api", routes);

// 404 y manejo centralizado de errores (siempre al final)
app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
