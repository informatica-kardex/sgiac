import { Aula } from "./aula.types";

// ------------------------------------------------------------
// Datos simulados (mock) del modulo de Aulas.
// Estructura identica a la que tendria la tabla real "aula"
// cuando se conecte a Supabase. Reemplazar este archivo por
// llamadas a Prisma (aula.repository.ts) sin tocar el resto
// de las capas (service/controller/routes).
// ------------------------------------------------------------
export let aulasMock: Aula[] = [
  { idAula: 1, codigo: "A-101", nombre: "Aula 101", capacidad: 40, ubicacion: "Bloque A - Piso 1", estado: "disponible" },
  { idAula: 2, codigo: "A-102", nombre: "Aula 102", capacidad: 35, ubicacion: "Bloque A - Piso 1", estado: "disponible" },
  { idAula: 3, codigo: "A-201", nombre: "Aula 201", capacidad: 45, ubicacion: "Bloque A - Piso 2", estado: "mantenimiento" },
  { idAula: 4, codigo: "B-101", nombre: "Laboratorio de Redes", capacidad: 25, ubicacion: "Bloque B - Piso 1", estado: "disponible" },
  { idAula: 5, codigo: "B-102", nombre: "Laboratorio de Software", capacidad: 30, ubicacion: "Bloque B - Piso 1", estado: "disponible" },
  { idAula: 6, codigo: "B-201", nombre: "Aula 201-B", capacidad: 40, ubicacion: "Bloque B - Piso 2", estado: "disponible" },
  { idAula: 7, codigo: "C-101", nombre: "Auditorio Kardex", capacidad: 120, ubicacion: "Bloque C - Planta baja", estado: "disponible" },
  { idAula: 8, codigo: "C-102", nombre: "Sala de reuniones", capacidad: 15, ubicacion: "Bloque C - Piso 1", estado: "inhabilitada" },
  { idAula: 9, codigo: "D-101", nombre: "Aula 101-D", capacidad: 38, ubicacion: "Bloque D - Piso 1", estado: "disponible" },
  { idAula: 10, codigo: "D-102", nombre: "Laboratorio de Bases de Datos", capacidad: 28, ubicacion: "Bloque D - Piso 1", estado: "disponible" },
];

export function nextAulaId(): number {
  return aulasMock.length > 0 ? Math.max(...aulasMock.map((a) => a.idAula)) + 1 : 1;
}
