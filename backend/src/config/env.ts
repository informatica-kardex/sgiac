import dotenv from "dotenv";
import path from "node:path";

// La misma ruta sirve para src/config y dist/config, sin depender del cwd.
// Las variables suministradas por el entorno conservan su prioridad.
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno requerida: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 4000,
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN?.trim() || "",

  databaseUrl: required("DATABASE_URL"),
  directUrl: process.env.DIRECT_URL || "",

  jwtSecret: required("JWT_SECRET"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET"),
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",

  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",

  cookieSecure: process.env.COOKIE_SECURE === "true",
};

export const isProduction = env.nodeEnv === "production";
