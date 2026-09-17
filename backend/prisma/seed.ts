/* eslint-disable no-console */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const ROLES = [
  {
    nombre: "ADMINISTRADOR",
    descripcion: "Acceso total al sistema, gestion de usuarios y configuracion",
  },
  {
    nombre: "SUBADMINISTRADOR_ACADEMICO",
    descripcion: "Gestiona aulas, horarios, comunicados y preguntas frecuentes",
  },
  {
    nombre: "SUBADMINISTRADOR_ATENCION",
    descripcion: "Gestiona fichas de atencion Kardex",
  },
  {
    nombre: "CONSULTA_INTERNA",
    descripcion: "Rol por defecto asignado a usuarios registrados desde el portal publico",
  },
];

const ADMIN_CORREO = "admin@sgiac.edu.bo";
const ADMIN_PASSWORD_TEMPORAL = "Admin123*";
const ADMIN_NOMBRE = "Administrador SGIAC";

async function main() {
  console.log("Iniciando seed de SGIAC...");

  // 1. Crear roles del sistema
  for (const rol of ROLES) {
    await prisma.rol.upsert({
      where: { nombre: rol.nombre },
      update: { descripcion: rol.descripcion, estado: "ACTIVO" },
      create: { ...rol, estado: "ACTIVO" },
    });
    console.log(`  Rol asegurado: ${rol.nombre}`);
  }

  const rolAdministrador = await prisma.rol.findUnique({
    where: { nombre: "ADMINISTRADOR" },
  });

  if (!rolAdministrador) {
    throw new Error("No se pudo crear/encontrar el rol ADMINISTRADOR");
  }

  // 2. Crear usuario administrador inicial (si no existe)
  let admin = await prisma.usuario.findUnique({
    where: { correo: ADMIN_CORREO },
  });

  if (!admin) {
    const contrasenaHash = await bcrypt.hash(ADMIN_PASSWORD_TEMPORAL, 12);

    admin = await prisma.usuario.create({
      data: {
        nombreCompleto: ADMIN_NOMBRE,
        correo: ADMIN_CORREO,
        contrasenaHash,
        estado: "ACTIVO",
        correoVerificado: true,
        // Obliga a cambiar la contrasena temporal en el primer login
        debeCambiarPassword: true,
      },
    });

    console.log(`  Usuario administrador creado: ${admin.correo}`);
  } else {
    console.log(`  Usuario administrador ya existia: ${admin.correo}`);
  }

  // 3. Asignar rol ADMINISTRADOR (si no lo tiene ya)
  const yaTieneRol = await prisma.usuarioRol.findFirst({
    where: { idUsuario: admin.idUsuario, idRol: rolAdministrador.idRol },
  });

  if (!yaTieneRol) {
    await prisma.usuarioRol.create({
      data: { idUsuario: admin.idUsuario, idRol: rolAdministrador.idRol },
    });
    console.log("  Rol ADMINISTRADOR asignado al usuario inicial");
  }

  // 4. Registrar la creacion en bitacora
  await prisma.bitacora.create({
    data: {
      accion: "SEED_ADMIN_CREADO",
      entidadAfectada: "usuario",
      idRegistroAfectado: admin.idUsuario.toString(),
      detalle: `Seed ejecutado: usuario administrador inicial (${admin.correo})`,
      idUsuario: admin.idUsuario,
    },
  });

  console.log("Seed completado correctamente.");
  console.log("----------------------------------------------------");
  console.log(`  Correo:               ${ADMIN_CORREO}`);
  console.log(`  Contrasena temporal:  ${ADMIN_PASSWORD_TEMPORAL}`);
  console.log("  (se solicitara cambio de contrasena en el primer login)");
  console.log("----------------------------------------------------");
}

main()
  .catch((error) => {
    console.error("Error ejecutando el seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
