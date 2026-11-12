import { Link, useLocation } from "react-router-dom";
import { AdminIcon } from "./AdminIcon";
import { AccountMenu } from "../../components/AccountMenu";

const titles: Record<string, string> = { documentos: "Trámites en línea", "ver-horarios": "Ver Horarios", docentes: "Docentes", auxiliares: "Auxiliares", "solicitudes-aulas": "Solicitudes de aulas", materias: "Materias", auditoria: "Auditoría", dashboard: "Dashboard", aulas: "Gestión de aulas", horarios: "Gestión de horarios", comunicados: "Comunicados", faq: "Preguntas frecuentes", fichas: "Atención Kardex", reportes: "Reportes", subadministradores: "Subadministradores", estudiantes: "Estudiantes", roles: "Roles y permisos", configuracion: "Configuración" };
export function AdminNavbar({ open, onMenu, pending }: { open: boolean; onMenu: () => void; pending: Record<string, number> }) {
  const location = useLocation();
  const entries = Object.entries(pending).filter(([, count]) => count > 0);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  return <header className="sticky top-0 z-30 flex h-[78px] items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 sm:px-8">
    <div className="flex min-w-0 items-center gap-3">
      <button onClick={onMenu} className="grid h-9 w-9 place-items-center border border-slate-200 lg:hidden" aria-label="Abrir menú" aria-expanded={open} aria-controls="admin-navigation"><AdminIcon name="menu" /></button>
      <div className="min-w-0"><p className="truncate text-[9px] font-bold uppercase tracking-wider text-slate-400">SGIAC · Administración</p><p className="mt-1 truncate text-lg font-bold">{titles[location.pathname.split("/").pop() ?? ""] ?? "Administración"}</p></div>
    </div>
    <div className="flex shrink-0 items-center gap-5">
      {total > 0 && <Link to={`/admin/${entries[0][0]}`} className="relative grid h-10 w-10 place-items-center rounded-full text-slate-600 hover:bg-slate-100" aria-label={`${total} solicitudes pendientes. Abrir ${titles[entries[0][0]]}`} title={entries.map(([key, count]) => `${titles[key]}: ${count}`).join(" · ")}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
        <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-5 text-white">{total > 99 ? "99+" : total}</span>
      </Link>}
      <span className="sr-only" role="status">{total > 0 ? `${total} solicitudes pendientes` : "Sin solicitudes pendientes"}</span>
      <Link to="/" target="_blank" rel="noopener noreferrer" className="hidden items-center gap-2 text-xs font-medium text-slate-500 hover:text-[#2459a9] md:flex">Ver portal público <AdminIcon name="arrow" size={15} /></Link>
      <AccountMenu />
    </div>
  </header>;
}
