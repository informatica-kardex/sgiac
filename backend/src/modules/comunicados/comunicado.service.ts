import { ApiError } from "../../utils/apiError";
import { ComunicadoRepository } from "./comunicado.repository";
import {
  ActualizarComunicadoInput,
  CrearComunicadoInput,
} from "./comunicado.validation";

export class ComunicadoService {
  private repository = new ComunicadoRepository();

  async listarPublicados() {
    return this.repository.findAllPublicados();
  }

  async listarTodos() {
    return this.repository.findAll();
  }

  async obtener(idComunicado: number) {
    const comunicado = await this.repository.findById(idComunicado);
    if (!comunicado) {
      throw ApiError.notFound("Comunicado no encontrado");
    }
    return comunicado;
  }

  async crear(input: CrearComunicadoInput) {
    return this.repository.create(input);
  }

  async actualizar(idComunicado: number, input: ActualizarComunicadoInput) {
    return this.repository.update(idComunicado, input);
  }

  async eliminar(idComunicado: number) {
    return this.repository.delete(idComunicado);
  }

  async archivar(idComunicado: number) {
    return this.repository.update(idComunicado, { estado: "archivado" });
  }

  async publicar(idComunicado: number) {
    return this.repository.update(idComunicado, { estado: "publicado" });
  }
}
