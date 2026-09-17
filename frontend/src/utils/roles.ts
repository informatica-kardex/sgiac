// Espejo de ROLES_ADMINISTRATIVOS definido en el backend
// (backend/src/modules/roles/role.repository.ts). Se mantiene
// como constante propia del frontend para no depender de una
// importacion cruzada backend/frontend.
export const ROLES_ADMINISTRATIVOS = [
  "ADMINISTRADOR",
  "SUBADMINISTRADOR_ACADEMICO",
  "SUBADMINISTRADOR_ATENCION",
] as const;

export function esRolAdministrativo(roles: string[]): boolean {
  return roles.some((rol) => (ROLES_ADMINISTRATIVOS as readonly string[]).includes(rol));
}
