import { useEffect, useId, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { solicitudesAulasApi } from "../../api/solicitudes-aulas.api";
import "../../styles/portal-navigation.css";

const NAV_LINKS = [
  { to: "/", label: "Inicio", detail: "El punto de partida", end: true },
  { to: "/comunicados", label: "Comunicados", detail: "Novedades de la carrera" },
  { to: "/horarios", label: "Horarios", detail: "Materias, aulas y clases" },
  { to: "/faq", label: "Preguntas frecuentes", detail: "Resuelve tus dudas" },
  { to: "/atencion", label: "Atención Kardex", detail: "Solicita tu atención" },
  { to: "/informacion", label: "Información", detail: "Conoce nuestro servicio" },
];
const STUDENT_LINKS = [
  { to: "/usuario/dashboard", label: "Mi inicio", detail: "Tu espacio universitario", end: true },
  { to: "/usuario/fichas", label: "Mis fichas", detail: "Solicitudes y turnos" },
  { to: "/usuario/documentos", label: "Mis documentos", detail: "Solicita y recoge en Kardex" },
  { to: "/usuario/horarios", label: "Horarios", detail: "Consulta tus clases" },
  { to: "/usuario/arma-tu-horario", label: "Arma tu horario", detail: "Organiza tu semestre" },
  { to: "/usuario/comunicados", label: "Comunicados", detail: "Novedades de la carrera" },
  { to: "/usuario/faq", label: "Ayuda", detail: "Encuentra una respuesta" },
];

export function Header({ portal = false }: { portal?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isAuthenticated, usuario } = useAuth();
  const [esAuxiliar, setEsAuxiliar] = useState(false);
  const { pathname } = useLocation();
  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLElement>(null);
  const menuId = useId();
  const links = isAuthenticated ? [...STUDENT_LINKS, ...(esAuxiliar ? [{ to: '/usuario/solicitudes-aulas', label: 'Solicitar aula', detail: 'Auxiliarías y seguimiento', end: false }] : [])] : NAV_LINKS;
  const accountPath = isAuthenticated ? "/usuario/perfil" : "/login";
  const accountLabel = isAuthenticated ? "Mi perfil" : "Ingresar";

  useEffect(() => { setMenuOpen(false); }, [pathname, isAuthenticated]);
  useEffect(() => {
    let active = true;
    if (!isAuthenticated || !usuario?.correoVerificado || usuario.debeCambiarPassword) { setEsAuxiliar(false); return; }
    solicitudesAulasApi.perfil().then(p => { if (active) setEsAuxiliar(p.habilitado); }).catch(() => { if (active) setEsAuxiliar(false); });
    return () => { active = false; };
  }, [isAuthenticated, usuario?.idUsuario, usuario?.correoVerificado, usuario?.debeCambiarPassword, pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => { setMenuOpen(false); toggleRef.current?.focus(); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); close(); } };
    const onPointer = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const desktop = window.matchMedia("(min-width: 1180px)");
    const onResize = () => { if (desktop.matches) setMenuOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    desktop.addEventListener("change", onResize);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      desktop.removeEventListener("change", onResize);
    };
  }, [menuOpen]);

  return <header ref={headerRef} className={`kardex-header${menuOpen ? " is-open" : ""}`}
    onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setMenuOpen(false); }}>
    <div className="container-public kardex-header-row">
      <Link to={isAuthenticated ? "/usuario/dashboard" : "/"} aria-label="Kardex — Inicio" className="kardex-brand" onClick={() => setMenuOpen(false)}>
        <img src="/images/kardex.png" alt="" width="56" height="56" />
        <div><strong>Kardex</strong><span className={portal ? "" : "kardex-brand-subtitle"}>{isAuthenticated ? "Portal del estudiante" : "Carrera de Informática"}</span></div>
      </Link>

      <nav className="kardex-desktop-nav" aria-label="Navegación principal">
        {links.map(link => <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => `kardex-nav-link${isActive ? " is-active" : ""}`}>
          <span>{link.label}</span>
        </NavLink>)}
      </nav>

      <div className="kardex-header-actions">
        <Link to={accountPath} className={`kardex-account${isAuthenticated ? " is-student" : ""}`} aria-label={isAuthenticated ? "Ver mi perfil" : "Ingresar"} onClick={() => setMenuOpen(false)}>
          <span>{accountLabel}</span>
        </Link>
        <button ref={toggleRef} type="button" className="kardex-menu-toggle" aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"} aria-controls={menuId} aria-expanded={menuOpen}
          onClick={() => setMenuOpen(open => !open)} onKeyDown={event => {
            if (event.key === "ArrowDown") { event.preventDefault(); setMenuOpen(true); requestAnimationFrame(() => menuRef.current?.querySelector<HTMLAnchorElement>("a")?.focus()); }
          }}>
          <span>{menuOpen ? "Cerrar" : "Menú"}</span>
        </button>
      </div>
    </div>

    {menuOpen && <>
      <button type="button" className="kardex-menu-scrim" tabIndex={-1} aria-label="Cerrar menú de navegación" onClick={() => { setMenuOpen(false); toggleRef.current?.focus(); }}/>
      <nav ref={menuRef} id={menuId} className="kardex-mobile-nav" aria-label="Navegación principal móvil">
        <p className="kardex-menu-caption">{isAuthenticated ? "TU PORTAL, A MANO" : "EXPLORA KARDEX"}</p>
        <div className="kardex-mobile-links">{links.map(link => <NavLink key={link.to} to={link.to} end={link.end} onClick={() => setMenuOpen(false)} className={({ isActive }) => `kardex-mobile-link${isActive ? " is-active" : ""}`}>
          <span><strong>{link.label}</strong><small>{link.detail}</small></span>
        </NavLink>)}</div>
        <Link className="kardex-menu-account" to={accountPath} onClick={() => setMenuOpen(false)}>{accountLabel}</Link>
      </nav>
    </>}
  </header>;
}
