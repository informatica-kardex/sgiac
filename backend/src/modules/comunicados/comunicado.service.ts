import { ComunicadoRepository } from "./comunicado.repository";
import { ArchivoGuardado, eliminarArchivo, guardarArchivo, MAX_COMUNICADO_IMAGENES } from "./comunicado.files";
import { ApiError } from "../../utils/apiError";
import { ActualizarComunicadoInput, CrearComunicadoInput } from "./comunicado.validation";

async function limpiar(claves: string[]) {
  for (const clave of claves) {
    try { await eliminarArchivo(clave); }
    catch { console.warn("[COMUNICADOS] No se pudo limpiar un archivo retirado"); }
  }
}
export class ComunicadoService {
  private repository = new ComunicadoRepository();
  listarPublicados() { return this.repository.findAllPublicados(); }
  listarTodos() { return this.repository.findAll(); }
  obtener(id: bigint, publico = false) { return this.repository.findById(id, publico); }
  archivo(id: bigint, adjunto: bigint, publico: boolean) { return this.repository.findArchivo(id, adjunto, publico); }

  async guardar(input: CrearComunicadoInput | ActualizarComunicadoInput, actor: bigint, id?: bigint, files?: Express.Multer.File | Express.Multer.File[]) {
    const nuevos = files ? (Array.isArray(files) ? files : [files]) : [];
    const archivos: ArchivoGuardado[] = [];
    let result;
    try {
      if (nuevos.length) {
        const tipo = input.tipo ?? (id ? (await this.obtener(id)).tipo : "texto");
        if (nuevos.length > MAX_COMUNICADO_IMAGENES) throw ApiError.badRequest("Puedes adjuntar hasta 10 imágenes por comunicado");
        if (tipo === "pdf" && nuevos.length > 1) throw ApiError.badRequest("Adjunta un solo documento PDF");
        for (const file of nuevos) archivos.push(await guardarArchivo(file, tipo));
      }
      result = await this.repository.guardar(input, actor, id, archivos);
    } catch (error) { await limpiar(archivos.map(a => a.clave)); throw error; }
    await limpiar(result.retirados);
    return result.comunicado;
  }
  async eliminar(id: bigint, actor: bigint) { await limpiar(await this.repository.delete(id, actor)); }
}
