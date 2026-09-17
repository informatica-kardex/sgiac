export class ApiError extends Error {
  public statusCode: number;
  public details?: unknown;
  public isOperational: boolean;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  static badRequest(message = "Solicitud invalida", details?: unknown) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = "No autorizado") {
    return new ApiError(401, message);
  }

  static forbidden(message = "Acceso denegado") {
    return new ApiError(403, message);
  }

  static notFound(message = "Recurso no encontrado") {
    return new ApiError(404, message);
  }

  static conflict(message = "Conflicto con el estado actual del recurso") {
    return new ApiError(409, message);
  }

  static internal(message = "Error interno del servidor") {
    return new ApiError(500, message);
  }
}
