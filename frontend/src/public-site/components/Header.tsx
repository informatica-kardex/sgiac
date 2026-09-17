import { useState } from "react";
import { Link, NavLink } from "react-router-dom";

const NAV_LINKS = [
  { to: "/", label: "Inicio", end: true },
  { to: "/comunicados", label: "Comunicados" },
  { to: "/horarios", label: "Horarios" },
  { to: "/faq", label: "Preguntas frecuentes" },
  { to: "/atencion", label: "Atención Kardex" },
  { to: "/informacion", label: "Información" },
];

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="container-public flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-700 font-bold text-white">
            S
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold text-slate-800">SGIAC</p>
            <p className="hidden text-[10px] text-slate-500 sm:block">
              Carrera de Informática
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
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
          <Link to="/login" className="btn-secondary hidden sm:inline-flex">
            Ingresar
          </Link>
          <button
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Abrir menú"
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
            {NAV_LINKS.map((link) => (
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
              to="/login"
              onClick={() => setMenuOpen(false)}
              className="btn-secondary mt-2 justify-center"
            >
              Ingresar
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
