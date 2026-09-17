import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-900 text-slate-300">
      <div className="container-public grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 font-bold text-white">
              S
            </div>
            <p className="font-bold text-white">SGIAC</p>
          </div>
          <p className="text-sm text-slate-400">
            Sistema de Gestión Integral de Aulas y Comunicaciones de Kardex —
            Carrera de Informática.
          </p>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-200">
            Navegación
          </p>
          <ul className="space-y-2 text-sm text-slate-400">
            <li><Link to="/comunicados" className="hover:text-white">Comunicados</Link></li>
            <li><Link to="/horarios" className="hover:text-white">Horarios</Link></li>
            <li><Link to="/faq" className="hover:text-white">Preguntas frecuentes</Link></li>
            <li><Link to="/atencion" className="hover:text-white">Atención Kardex</Link></li>
          </ul>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-200">
            Atención Kardex
          </p>
          <ul className="space-y-2 text-sm text-slate-400">
            <li>Lunes a viernes, 8:00 - 16:00</li>
            <li>Bloque C, planta baja</li>
            <li>kardex.informatica@universidad.edu.bo</li>
          </ul>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-200">
            Acceso institucional
          </p>
          <Link to="/login" className="text-sm text-primary-300 hover:text-primary-200">
            Ingresar a mi cuenta →
          </Link>
        </div>
      </div>

      <div className="border-t border-slate-800 py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} SGIAC — Carrera de Informática. Todos los derechos reservados.
      </div>
    </footer>
  );
}
