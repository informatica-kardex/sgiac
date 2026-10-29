import multer from "multer";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { ApiError } from "../../utils/apiError";

export const MAX_COMUNICADO_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_COMUNICADO_IMAGENES = 10;
export const uploadComunicado = multer({
  storage: multer.memoryStorage(),
  limits: { files: MAX_COMUNICADO_IMAGENES, fileSize: MAX_COMUNICADO_FILE_SIZE, fields: 8, fieldSize: 100000, parts: 18 },
}).array("archivo", MAX_COMUNICADO_IMAGENES);

export interface ArchivoGuardado { nombre: string; mime: string; clave: string; }
const directorio = () => path.resolve(process.env.COMUNICADOS_UPLOAD_DIR || path.join(__dirname, "../../../uploads/comunicados"));

export function detectarArchivo(buffer: Buffer): { mime: string; extension: string; tipo: "imagen" | "pdf" } {
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && buffer.toString("ascii", 12, 16) === "IHDR") {
    return { mime: "image/png", extension: ".png", tipo: "imagen" };
  }
  if (buffer.length >= 4 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) {
    return { mime: "image/jpeg", extension: ".jpg", tipo: "imagen" };
  }
  if (buffer.length >= 16 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return { mime: "image/webp", extension: ".webp", tipo: "imagen" };
  }
  if (/^%PDF-\d\.\d/.test(buffer.toString("ascii", 0, 8)) && buffer.subarray(-2048).includes(Buffer.from("%%EOF"))) {
    return { mime: "application/pdf", extension: ".pdf", tipo: "pdf" };
  }
  throw ApiError.badRequest("El archivo debe ser una imagen JPG, PNG o WebP, o un PDF válido");
}

export function rutaArchivo(clave: string) {
  if (!/^[a-f0-9-]{36}\.(png|jpg|webp|pdf)$/.test(clave)) throw ApiError.notFound("Archivo no encontrado");
  return path.join(directorio(), clave);
}

export async function guardarArchivo(file: Express.Multer.File, tipo: string): Promise<ArchivoGuardado> {
  if (!file.size || file.size > MAX_COMUNICADO_FILE_SIZE) throw ApiError.badRequest("El archivo debe pesar entre 1 byte y 10 MB");
  const detectado = detectarArchivo(file.buffer);
  if (detectado.tipo !== tipo) throw ApiError.badRequest("El archivo no corresponde al tipo de comunicado seleccionado");
  const clave = randomUUID() + detectado.extension;
  await mkdir(directorio(), { recursive: true });
  await writeFile(rutaArchivo(clave), file.buffer, { flag: "wx" });
  const nombre = path.basename(file.originalname.replace(/\\/g, "/")).replace(/[\x00-\x1f\x7f]/g, "").slice(0, 240);
  return { nombre: nombre || `comunicado${detectado.extension}`, mime: detectado.mime, clave };
}

export async function eliminarArchivo(clave: string) {
  try { await unlink(rutaArchivo(clave)); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
