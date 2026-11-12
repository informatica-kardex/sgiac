import { UsuarioSesion } from "../api/types";
import { ROL_LABEL } from "../utils/formatters";

export function accountRoleLabel(roles: string[]) {
  return roles.map(role => role === "CONSULTA_INTERNA" ? "Estudiante" : ROL_LABEL[role] ?? role).join(" · ") || "Cuenta institucional";
}

export function AccountAvatar({ usuario, large = false }: { usuario: UsuarioSesion; large?: boolean }) {
  const initials = usuario.nombreCompleto.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join("");
  return <span className={`account-avatar${large ? " account-avatar--large" : ""}`} aria-hidden="true">{initials || "K"}</span>;
}
