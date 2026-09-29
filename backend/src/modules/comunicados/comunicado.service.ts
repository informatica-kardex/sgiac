import { ComunicadoRepository } from "./comunicado.repository";
import { ArchivoGuardado, eliminarArchivo, guardarArchivo } from "./comunicado.files";
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

  async guardar(input: CrearComunicadoInput | ActualizarComunicadoInput, actor: bigint, id?: bigint, file?: Express.Multer.File) {
    let archivo: ArchivoGuardado | undefined;
    if (file) {
      const tipo = input.tipo ?? (id ? (await this.obtener(id)).tipo : "texto");
      archivo = await guardarArchivo(file, tipo);
    }
    let result;
    try { result = await this.repository.guardar(input, actor, id, archivo); }
    catch (error) { if (archivo) await limpiar([archivo.clave]); throw error; }
    await limpiar(result.retirados);
    return result.comunicado;
  }
  async eliminar(id: bigint, actor: bigint) { await limpiar(await this.repository.delete(id, actor)); }
}
