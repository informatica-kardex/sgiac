import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAdminAuthStore } from "../store/adminAuthStore";
import { useUserAuthStore } from "../store/userAuthStore";
import { useAuth } from "../hooks/useAuth";
import { esRolAdministrativo } from "../utils/roles";
import { AdminIcon } from "../admin/components/AdminIcon";
import { AccountAvatar, accountRoleLabel } from "./AccountIdentity";
import { estudiantesApi } from "../api/estudiantes.api";
import "../styles/account.css";

export function AccountMenu({ variant = "admin", onOpen }: { variant?: "admin" | "portal"; onOpen?: () => void }) {
  const admin = useAdminAuthStore();
  const student = useUserAuthStore();
  const usuario = admin.isAuthenticated ? admin.usuario : student.isAuthenticated ? student.usuario : null;
  const { logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [studentIdentity, setStudentIdentity] = useState<{ id: string; fullName: string; shortName: string } | null>(null);
  const isStudent = !!usuario && !esRolAdministrativo(usuario.roles);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!isStudent || !usuario?.correoVerificado || usuario.debeCambiarPassword) return;
    let active = true;
    const id = usuario.idUsuario, fullName = usuario.nombreCompleto;
    // Usar los campos separados evita confundir el segundo nombre con el apellido.
    estudiantesApi.perfil().then(({ data }) => {
      if (active) setStudentIdentity({ id, fullName,
        shortName: [data.data.nombres.trim().split(/\s+/)[0], data.data.apellidos.trim().split(/\s+/)[0]].filter(Boolean).join(" "),
      });
    }).catch(() => { /* El menú sigue disponible con el nombre de la sesión. */ });
    return () => { active = false; };
  }, [isStudent, usuario?.idUsuario, usuario?.nombreCompleto, usuario?.correoVerificado, usuario?.debeCambiarPassword]);

  useEffect(() => { setOpen(false); }, [location.key, usuario?.idUsuario]);
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const outside = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  if (!usuario) return <Link className="kardex-account" to="/login">Ingresar</Link>;
  const displayName = isStudent && studentIdentity?.id === usuario.idUsuario && studentIdentity.fullName === usuario.nombreCompleto
    ? studentIdentity.shortName || usuario.nombreCompleto : usuario.nombreCompleto;
  const accountPath = esRolAdministrativo(usuario.roles) ? "/admin/configuracion" : "/usuario/perfil";
  const close = () => { setOpen(false); trigger.current?.focus(); };
  const toggle = () => { if (!open) onOpen?.(); setOpen(value => !value); };

  return <div ref={container} className={`account-menu account-menu--${variant}${isStudent ? " account-menu--student" : ""}`}
    onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }}
    onKeyDown={event => {
      if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); close(); return; }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      if (!open) { onOpen?.(); setOpen(true); return; }
      const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
      const index = items.indexOf(document.activeElement as HTMLElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowUp" ? -1 : 1) + items.length) % items.length;
      items[next]?.focus();
    }}>
    <button ref={trigger} type="button" className="account-menu__trigger" aria-label="Abrir menú de mi cuenta"
      aria-haspopup="menu" aria-expanded={open} aria-controls={id} onClick={toggle}>
      <AccountAvatar usuario={isStudent ? { ...usuario, nombreCompleto: displayName } : usuario} />
      <span className="account-menu__identity"><strong title={usuario.nombreCompleto}>{displayName}</strong><small>{isStudent ? "Estudiante" : accountRoleLabel(usuario.roles)}</small></span>
      <svg className="account-menu__chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>
    {open && <div className="account-menu__popover">
      <div className="account-menu__summary"><span>MI CUENTA</span><strong>{usuario.nombreCompleto}</strong><p>{usuario.correo}</p><small>{accountRoleLabel(usuario.roles)}</small></div>
      <div ref={menu} id={id} role="menu" aria-label="Opciones de mi cuenta" className="account-menu__items">
        <Link role="menuitem" to={`${accountPath}?seccion=perfil`} onClick={() => setOpen(false)}><AdminIcon name="estudiantes" /><span><strong>Mi perfil</strong><small>Consulta tus datos personales</small></span><AdminIcon name="arrow" size={15} /></Link>
        <Link role="menuitem" to={`${accountPath}?seccion=seguridad`} onClick={() => setOpen(false)}><AdminIcon name="roles" /><span><strong>Seguridad de la cuenta</strong><small>Gestiona la protección de tu acceso</small></span><AdminIcon name="arrow" size={15} /></Link>
        <div className="account-menu__divider" role="separator" />
        <button role="menuitem" type="button" className="account-menu__signout" disabled={busy} onClick={async () => {
          setBusy(true);
          try { await logout(); } catch { /* El hook también limpia la sesión local si falla la conexión. */ }
          finally { setOpen(false); setBusy(false); }
        }}><AdminIcon name="logout" /><span>{busy ? "Cerrando sesión…" : "Cerrar sesión"}</span></button>
      </div>
    </div>}
  </div>;
}
