import { ApiError } from "../../utils/apiError";
import { Horario } from "./horario.types";
import { horariosMock, nextHorarioId } from "./horario.mock";
import { ActualizarHorarioInput, CrearHorarioInput } from "./horario.validation";

export class HorarioRepository {
  async findAll(): Promise<Horario[]> {
    return [...horariosMock];
  }

  async findById(idHorario: number): Promise<Horario | undefined> {
    return horariosMock.find((h) => h.idHorario === idHorario);
  }

  async create(input: CrearHorarioInput): Promise<Horario> {
    const nuevo: Horario = { idHorario: nextHorarioId(), ...input };
    horariosMock.push(nuevo);
    return nuevo;
  }

  async update(idHorario: number, input: ActualizarHorarioInput): Promise<Horario> {
    const index = horariosMock.findIndex((h) => h.idHorario === idHorario);
    if (index === -1) {
      throw ApiError.notFound("Horario no encontrado");
    }
    horariosMock[index] = { ...horariosMock[index], ...input };
    return horariosMock[index];
  }

  async delete(idHorario: number): Promise<void> {
    const index = horariosMock.findIndex((h) => h.idHorario === idHorario);
    if (index === -1) {
      throw ApiError.notFound("Horario no encontrado");
    }
    horariosMock.splice(index, 1);
  }
}
