export function formatFecha(iso: string, opciones?: Intl.DateTimeFormatOptions): string {
  try {
    return new Date(iso).toLocaleDateString("es-BO", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      ...opciones,
    });
  } catch {
    return iso;
  }
}

export function formatFechaHora(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-BO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export const DIAS_SEMANA_LABEL: Record<string, string> = {
  LUNES: "Lunes",
  MARTES: "Martes",
  MIERCOLES: "Miércoles",
  JUEVES: "Jueves",
  VIERNES: "Viernes",
  SABADO: "Sábado",
};

export const ROL_LABEL: Record<string, string> = {
  ADMINISTRADOR: "Administrador",
  SUBADMINISTRADOR: "Subadministrador",
  CONSULTA_INTERNA: "Consulta interna",
};
