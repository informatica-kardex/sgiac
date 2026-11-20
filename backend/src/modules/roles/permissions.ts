export const FUNCIONES_SUBADMIN = ["docentes", "auxiliares", "materias", "aulas", "horarios", "ver-horarios", "solicitudes-aulas", "comunicados", "faq", "fichas", "documentos", "estudiantes", "reportes", "auditoria"] as const;
export type FuncionSubadmin = typeof FUNCIONES_SUBADMIN[number];
export interface Permiso {
  modulo: string;
  desde: Date | string | null;
  hasta: Date | string | null;
}

export function tienePermiso(usuario: { roles: string[]; permisos?: Permiso[] } | undefined, modulo: FuncionSubadmin, ahora = Date.now()) {
  if (!usuario) return false;
  if (usuario.roles.includes("ADMINISTRADOR")) return true;
  return usuario.roles.includes("SUBADMINISTRADOR") && Boolean(usuario.permisos?.some(p =>
    p.modulo === modulo && (p.desde === null && p.hasta === null ||
      p.desde !== null && p.hasta !== null && new Date(p.desde).getTime() <= ahora && ahora < new Date(p.hasta).getTime())));
}
