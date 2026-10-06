import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename, unlink } from "node:fs/promises";
import multer from "multer";
import { z } from "zod";
import { ApiError } from "../../utils/apiError";

const archivoSchema = z.object({ id: z.string().uuid(), nombre: z.string(), mime: z.string(), extension: z.enum(["png", "jpg", "webp", "mp4", "webm"]) });
const configSchema = z.object({ voz: z.boolean(), revision: z.string(), pruebaVoz: z.string(), archivos: z.array(archivoSchema).max(20) });
type Config = z.infer<typeof configSchema>;
export const tvConfigInput = z.object({ voz: z.boolean() }).strict();
export const uploadTV = multer({ storage: multer.memoryStorage(), limits: { files: 1, fileSize: 100 * 1024 * 1024, fields: 0, parts: 1 } }).single("archivo");
const directorio = () => path.resolve(process.env.TV_UPLOAD_DIR || path.join(__dirname, "../../../uploads/tv"));
// Un solo escritor en la instancia de Express; JSON reemplazado de forma atómica.
let pendiente: Promise<unknown> = Promise.resolve();
function exclusivo<T>(fn: () => Promise<T>): Promise<T> {
  const resultado = pendiente.then(fn, fn);
  pendiente = resultado.catch(() => undefined);
  return resultado;
}
async function leer(): Promise<Config> {
  try { return configSchema.parse(JSON.parse(await readFile(path.join(directorio(), "config.json"), "utf8"))); }
  catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return { voz: false, revision: "inicial", pruebaVoz: "inicial", archivos: [] };
    throw e;
  }
}
async function guardar(config: Config) {
  await mkdir(directorio(), { recursive: true });
  const temporal = path.join(directorio(), `${randomUUID()}.tmp`);
  try {
    await writeFile(temporal, JSON.stringify(config), { flag: "wx" });
    await rename(temporal, path.join(directorio(), "config.json"));
  } finally { await unlink(temporal).catch(() => undefined); }
}
function dto(config: Config) {
  return { voz: config.voz, revision: config.revision, pruebaVoz: config.pruebaVoz,
    archivos: config.archivos.map(a => ({ id: a.id, nombre: a.nombre, tipo: a.mime.startsWith("video/") ? "video" as const : "imagen" as const, url: `/api/fichas/tv/archivos/${a.id}` })) };
}
function detectar(buffer: Buffer): Pick<Config["archivos"][number], "mime" | "extension"> {
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && buffer.toString("ascii",12,16) === "IHDR") return { mime: "image/png", extension: "png" };
  if (buffer.length >= 4 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return { mime: "image/jpeg", extension: "jpg" };
  if (buffer.length >= 16 && buffer.toString("ascii",0,4) === "RIFF" && buffer.toString("ascii",8,12) === "WEBP") return { mime: "image/webp", extension: "webp" };
  if (buffer.length >= 16 && buffer.toString("ascii",4,8) === "ftyp" && /isom|iso2|mp4|avc1|M4V/.test(buffer.toString("ascii",8,40))) return { mime: "video/mp4", extension: "mp4" };
  if (buffer.length >= 16 && buffer.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3])) && buffer.subarray(0,4096).includes(Buffer.from("webm"))) return { mime: "video/webm", extension: "webm" };
  throw ApiError.badRequest("Elige una imagen PNG, JPG o WebP, o un video MP4/WebM válido.");
}

export const tvService = {
  async obtener() { return dto(await leer()); },
  actualizar(voz: boolean) { return exclusivo(async () => { const c = await leer(); c.voz = voz; await guardar(c); return dto(c); }); },
  comando(pruebaVoz = false) { return exclusivo(async () => { const c = await leer(); if (pruebaVoz) c.pruebaVoz = randomUUID(); else c.revision = randomUUID(); await guardar(c); return dto(c); }); },
  agregar(file?: Express.Multer.File) { return exclusivo(async () => {
    if (!file?.size) throw ApiError.badRequest("Selecciona un archivo.");
    const config = await leer();
    if (config.archivos.length >= 20) throw ApiError.conflict("Puedes publicar hasta 20 archivos. Retira uno antes de agregar otro.");
    const formato = detectar(file.buffer);
    const id = randomUUID();
    const nombre = path.basename(file.originalname.replace(/\\/g, "/")).replace(/[\x00-\x1f\x7f]/g, "").slice(0, 180);
    await mkdir(directorio(), { recursive: true });
    const ruta = path.join(directorio(), `${id}.${formato.extension}`);
    await writeFile(ruta, file.buffer, { flag: "wx" });
    config.archivos.push({ id, nombre: nombre || `Archivo.${formato.extension}`, ...formato });
    try { await guardar(config); } catch (e) { await unlink(ruta).catch(() => undefined); throw e; }
    return dto(config);
  }); },
  eliminar(id: string) { return exclusivo(async () => {
    const config = await leer(); const archivo = config.archivos.find(a => a.id === id);
    if (!archivo) throw ApiError.notFound("Archivo no encontrado");
    config.archivos = config.archivos.filter(a => a.id !== id);
    await guardar(config);
    await unlink(path.join(directorio(), `${archivo.id}.${archivo.extension}`)).catch(e => { if (e.code !== "ENOENT") throw e; });
    return dto(config);
  }); },
  async archivo(id: string) {
    const archivo = (await leer()).archivos.find(a => a.id === id);
    if (!archivo) throw ApiError.notFound("Archivo no encontrado");
    return { ruta: path.join(directorio(), `${archivo.id}.${archivo.extension}`), mime: archivo.mime };
  },
};
