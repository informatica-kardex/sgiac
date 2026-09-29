import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

const NAV_LINKS = [
  { to: "/", label: "Inicio", end: true },
  { to: "/comunicados", label: "Comunicados" },
  { to: "/horarios", label: "Horarios" },
  { to: "/faq", label: "Preguntas frecuentes" },
  { to: "/atencion", label: "Atención Kardex" },
  { to: "/informacion", label: "Información" },
];

export function Header({ portal = false }: { portal?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const links = isAuthenticated ? [
    { to: "/usuario/dashboard", label: "Mi inicio", end: true },
    { to: "/usuario/fichas", label: "Mis fichas" },
    { to: "/usuario/horarios", label: "Horarios" },
    { to: "/usuario/arma-tu-horario", label: "Arma tu horario" },
    { to: "/usuario/comunicados", label: "Comunicados" },
    { to: "/usuario/faq", label: "Ayuda" },
  ] : NAV_LINKS;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="container-public flex h-16 items-center justify-between">
        <Link to={isAuthenticated ? "/usuario/dashboard" : "/"} aria-label="Kardex — Inicio" className="flex shrink-0 items-center gap-2.5">
          <img src="/images/kardex.png" alt="" width={640} height={640} className="h-14 w-14 shrink-0 object-contain" />
          <div className="leading-tight">
            <p className="text-sm font-bold text-slate-800">Kardex</p>
            <p className={`${portal ? "" : "hidden sm:block "}text-[10px] text-slate-500`}>
              {isAuthenticated ? "Portal del estudiante" : "Carrera de Informática"}
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-primary-50 text-primary-800"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {isAuthenticated ? <Link to="/usuario/perfil" aria-label="Ver mi perfil" title="Mi perfil" className="student-profile-link">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></svg>
            <span className="hidden sm:inline">Mi perfil</span>
          </Link> : <Link to="/login" className="btn-secondary hidden sm:inline-flex">
            Ingresar
          </Link>}
          <button
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Abrir menú"
            aria-expanded={menuOpen}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="border-t border-slate-200 bg-white px-4 py-3 lg:hidden">
          <div className="flex flex-col gap-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2.5 text-sm font-medium ${
                    isActive ? "bg-primary-50 text-primary-800" : "text-slate-600"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
            <Link
              to={isAuthenticated ? "/usuario/perfil" : "/login"}
              onClick={() => setMenuOpen(false)}
              className="btn-secondary mt-2 justify-center"
            >
              {isAuthenticated ? "Mi perfil" : "Ingresar"}
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
