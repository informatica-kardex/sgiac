import { PermisoUsuario } from "../api/types";
export const ROLES_ADMINISTRATIVOS = ["ADMINISTRADOR", "SUBADMINISTRADOR"] as const;
export function esRolAdministrativo(roles: string[]): boolean {
  return roles.some(rol => (ROLES_ADMINISTRATIVOS as readonly string[]).includes(rol));
}
export const FUNCIONES_SUBADMIN: Record<string, string> = {
  aulas: "Gestionar aulas", horarios: "Gestionar horarios", comunicados: "Gestionar comunicados",
  faq: "Gestionar preguntas frecuentes", fichas: "Gestionar atención Kardex", reportes: "Consultar reportes",
};
export const MODULOS_ADMIN: Record<string, { label: string }> = {
  dashboard: { label: "Dashboard" }, aulas: { label: "Aulas" }, horarios: { label: "Horarios" },
  comunicados: { label: "Comunicados" }, faq: { label: "Preguntas frecuentes" }, fichas: { label: "Atención Kardex" },
  reportes: { label: "Reportes" }, subadministradores: { label: "Subadministradores" }, estudiantes: { label: "Estudiantes" },
  roles: { label: "Roles y permisos" }, auditoria: { label: "Auditoría" }, configuracion: { label: "Configuración" },
};
export function permisoVigente(p: PermisoUsuario, ahora = Date.now()) {
  return p.desde === null && p.hasta === null || p.desde !== null && p.hasta !== null &&
    Date.parse(p.desde) <= ahora && ahora < Date.parse(p.hasta);
}
export function puedeAccederModulo(roles: string[], modulo: string, permisos: PermisoUsuario[] = []) {
  if (!MODULOS_ADMIN[modulo === "usuarios" ? "subadministradores" : modulo]) return false;
  if (roles.includes("ADMINISTRADOR")) return true;
  return roles.includes("SUBADMINISTRADOR") && (modulo === "dashboard" ||
    Object.prototype.hasOwnProperty.call(FUNCIONES_SUBADMIN, modulo) && permisos.some(p => p.modulo === modulo && permisoVigente(p)));
}
