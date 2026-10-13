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

export interface PermisoUsuario { modulo: string; desde: string | null; hasta: string | null; }

export interface UsuarioSesion {
  idUsuario: string;
  nombreCompleto: string;
  correo: string;
  roles: string[];
  permisos?: PermisoUsuario[];
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
  equipamiento?: { nombre: string; cantidad: number }[];
  idAula: string;
  lugar: string | null;
  piso: number | null;
  tipo: string;
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
  esAuxiliar?: boolean;
  esCoordinacion?: boolean;
  idHorario: number;
  materia: string;
  docente: string;
  aula: string;
  dia: DiaSemana;
  horaInicio: string;
  horaFin: string;
  grupo: string;
}

export interface HorarioAcademico extends Horario {
  sesionCompartida?: string | null;
  fecha: string | null;
  motivo: string;
  idAuxiliar: string | null;
  responsable: string;
  idAsignacion: string;
  idDocente: string;
  codigoMateria: string;
  siglas: string[];
  idPeriodo: string;
  periodo: string;
  lugar: string | null;
  piso: number | null;
}

export type EstadoComunicado = "publicado" | "borrador" | "archivado";

export interface Comunicado {
  idComunicado: string;
  tipo: "texto" | "imagen" | "pdf";
  titulo: string;
  contenido: string;
  resumen: string;
  categoria: string;
  fechaPublicacion: string;
  estado: EstadoComunicado;
  adjuntos: { idAdjunto: string; nombre: string; url: string; tipo: string }[];
}

export interface Faq {
  idFaq: number;
  pregunta: string;
  respuesta: string;
  categoria: string;
  estado: "publicada" | "borrador";
}

export interface UsuarioAdmin {
  ciRegistrado: boolean;
  idUsuario: string;
  nombreCompleto: string;
  correo: string;
  estado: string;
  correoVerificado: boolean;
  debeCambiarPassword: boolean;
  fechaCreacion: string;
  roles: string[];
  permisos?: PermisoUsuario[];
}

export interface Rol {
  idRol: string | number;
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
