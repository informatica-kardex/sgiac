import { ApiError } from "../../utils/apiError";
import { Comunicado } from "./comunicado.types";
import { comunicadosMock, nextComunicadoId } from "./comunicado.mock";
import {
  ActualizarComunicadoInput,
  CrearComunicadoInput,
} from "./comunicado.validation";

export class ComunicadoRepository {
  async findAllPublicados(): Promise<Comunicado[]> {
    return comunicadosMock.filter((c) => c.estado === "publicado");
  }

  async findAll(): Promise<Comunicado[]> {
    return [...comunicadosMock];
  }

  async findById(idComunicado: number): Promise<Comunicado | undefined> {
    return comunicadosMock.find((c) => c.idComunicado === idComunicado);
  }

  async create(input: CrearComunicadoInput): Promise<Comunicado> {
    const nuevo: Comunicado = {
      idComunicado: nextComunicadoId(),
      fechaPublicacion: new Date().toISOString(),
      adjuntos: [],
      ...input,
    };
    comunicadosMock.push(nuevo);
    return nuevo;
  }

  async update(
    idComunicado: number,
    input: ActualizarComunicadoInput
  ): Promise<Comunicado> {
    const index = comunicadosMock.findIndex((c) => c.idComunicado === idComunicado);
    if (index === -1) {
      throw ApiError.notFound("Comunicado no encontrado");
    }
    comunicadosMock[index] = { ...comunicadosMock[index], ...input };
    return comunicadosMock[index];
  }

  async delete(idComunicado: number): Promise<void> {
    const index = comunicadosMock.findIndex((c) => c.idComunicado === idComunicado);
    if (index === -1) {
      throw ApiError.notFound("Comunicado no encontrado");
    }
    comunicadosMock.splice(index, 1);
  }
}
