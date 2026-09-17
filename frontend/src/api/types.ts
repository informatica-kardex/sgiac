// ------------------------------------------------------------
// Tipos compartidos entre el frontend y las respuestas de la
// API del backend SGIAC.
// ------------------------------------------------------------

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  details?: unknown;
}

export interface UsuarioSesion {
  idUsuario: string;
  nombreCompleto: string;
  correo: string;
  roles: string[];
  correoVerificado: boolean;
  debeCambiarPassword: boolean;
}

export interface AuthResponse {
  usuario: UsuarioSesion;
  accessToken: string;
  refreshToken: string;
}

export type EstadoAula = "disponible" | "mantenimiento" | "inhabilitada";

export interface Aula {
  idAula: number;
  codigo: string;
  nombre: string;
  capacidad: number;
  ubicacion: string;
  estado: EstadoAula;
}

export type DiaSemana =
  | "LUNES"
  | "MARTES"
  | "MIERCOLES"
  | "JUEVES"
  | "VIERNES"
  | "SABADO";

export interface Horario {
  idHorario: number;
  materia: string;
  docente: string;
  aula: string;
  dia: DiaSemana;
  horaInicio: string;
  horaFin: string;
  grupo: string;
}

export type EstadoComunicado = "publicado" | "borrador" | "archivado";

export interface Comunicado {
  idComunicado: number;
  titulo: string;
  contenido: string;
  resumen: string;
  categoria: string;
  fechaPublicacion: string;
  estado: EstadoComunicado;
  adjuntos: { nombre: string; url: string }[];
}

export interface Faq {
  idFaq: number;
  pregunta: string;
  respuesta: string;
  categoria: string;
  estado: "publicada" | "borrador";
}

export type EstadoFicha = "pendiente" | "en_proceso" | "atendida" | "rechazada";

export interface FichaAtencion {
  idFicha: number;
  solicitante: string;
  correo: string;
  motivo: string;
  detalle: string;
  estado: EstadoFicha;
  fechaSolicitud: string;
  fechaAtencion: string | null;
  atendidoPor: string | null;
}

export interface UsuarioAdmin {
  idUsuario: number;
  nombreCompleto: string;
  correo: string;
  estado: string;
  correoVerificado: boolean;
  fechaCreacion: string;
  roles: string[];
}

export interface Rol {
  idRol: number;
  nombre: string;
  descripcion: string | null;
  estado: string;
}

export interface ResumenDashboard {
  totalAulas: number;
  aulasDisponibles: number;
  comunicadosActivos: number;
  totalUsuarios: number;
  usuariosActivos: number;
  atencionesPendientes: number;
  totalHorarios: number;
}

export interface ConteoCategoria {
  categoria: string;
  cantidad: number;
}

export interface ConteoEstado {
  estado: string;
  cantidad: number;
}
