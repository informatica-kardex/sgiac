import { ApiError } from "../../utils/apiError";
import { FichaAtencion } from "./ficha.types";
import { fichasMock, nextFichaId } from "./ficha.mock";
import { ActualizarFichaInput, CrearFichaInput } from "./ficha.validation";

export class FichaRepository {
  async findAll(): Promise<FichaAtencion[]> {
    return [...fichasMock];
  }

  async findById(idFicha: number): Promise<FichaAtencion | undefined> {
    return fichasMock.find((f) => f.idFicha === idFicha);
  }

  async create(input: CrearFichaInput): Promise<FichaAtencion> {
    const nueva: FichaAtencion = {
      idFicha: nextFichaId(),
      fechaSolicitud: new Date().toISOString(),
      fechaAtencion: null,
      atendidoPor: null,
      estado: "pendiente",
      ...input,
    };
    fichasMock.push(nueva);
    return nueva;
  }

  async update(idFicha: number, input: ActualizarFichaInput): Promise<FichaAtencion> {
    const index = fichasMock.findIndex((f) => f.idFicha === idFicha);
    if (index === -1) {
      throw ApiError.notFound("Ficha de atención no encontrada");
    }
    fichasMock[index] = {
      ...fichasMock[index],
      ...input,
      fechaAtencion:
        input.estado && input.estado !== "pendiente"
          ? new Date().toISOString()
          : fichasMock[index].fechaAtencion,
    };
    return fichasMock[index];
  }
}
