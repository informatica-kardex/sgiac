import app from "./app";
import { iniciarCorreosDocumentos, detenerCorreosDocumentos } from "./modules/documentos/documento.mail";
import { env } from "./config/env";
import { prisma } from "./database/prisma";
import { telegramService } from "./modules/telegram/telegram.service";

async function bootstrap() {
  try {
    await prisma.$connect();
    console.log("Conexion a la base de datos (Supabase/Postgres) establecida");

    app.listen(env.port, () => {
      console.log(`SGIAC API escuchando en http://localhost:${env.port}`);
      console.log(`Entorno: ${env.nodeEnv}`);
      console.log(`CORS habilitado para: ${env.frontendUrl}`);
      telegramService.start();
      iniciarCorreosDocumentos();
    });
  } catch (error) {
    console.error("Error al iniciar el servidor:", error);
    process.exit(1);
  }
}

process.on("SIGINT", async () => {
  await detenerCorreosDocumentos();
  await telegramService.stop();
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await detenerCorreosDocumentos();
  await telegramService.stop();
  await prisma.$disconnect();
  process.exit(0);
});

bootstrap();
