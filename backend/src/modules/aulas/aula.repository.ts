import { ApiError } from "../../utils/apiError";
import { Aula } from "./aula.types";
import { aulasMock, nextAulaId } from "./aula.mock";
import { CrearAulaInput, ActualizarAulaInput } from "./aula.validation";

// ------------------------------------------------------------
// Repositorio en memoria (mock). Expone la MISMA interfaz que
// tendria un repositorio respaldado por Prisma, para que el
// service/controller no necesiten cambiar cuando se conecte la
// tabla "aula" real en Supabase.
// ------------------------------------------------------------
export class AulaRepository {
  async findAll(): Promise<Aula[]> {
    return [...aulasMock];
  }

  async findById(idAula: number): Promise<Aula | undefined> {
    return aulasMock.find((a) => a.idAula === idAula);
  }

  async create(input: CrearAulaInput): Promise<Aula> {
    const nueva: Aula = { idAula: nextAulaId(), ...input };
    aulasMock.push(nueva);
    return nueva;
  }

  async update(idAula: number, input: ActualizarAulaInput): Promise<Aula> {
    const index = aulasMock.findIndex((a) => a.idAula === idAula);
    if (index === -1) {
      throw ApiError.notFound("Aula no encontrada");
    }
    aulasMock[index] = { ...aulasMock[index], ...input };
    return aulasMock[index];
  }

  async delete(idAula: number): Promise<void> {
    const index = aulasMock.findIndex((a) => a.idAula === idAula);
    if (index === -1) {
      throw ApiError.notFound("Aula no encontrada");
    }
    aulasMock.splice(index, 1);
  }
}
