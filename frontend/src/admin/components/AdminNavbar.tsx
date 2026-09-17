import { Link, useLocation } from "react-router-dom";
import { useAdminAuth } from "../../hooks/useAdminAuth";
import { ROL_LABEL } from "../../utils/formatters";
import { AdminIcon } from "./AdminIcon";

const titles: Record<string, string> = { auditoria: "Auditoría", dashboard: "Dashboard", aulas: "Gestión de aulas", horarios: "Gestión de horarios", comunicados: "Comunicados", faq: "Preguntas frecuentes", fichas: "Atención Kardex", reportes: "Reportes", usuarios: "Usuarios", roles: "Roles y permisos", configuracion: "Configuración" };
export function AdminNavbar({ open, onMenu }: { open: boolean; onMenu: () => void }) {
  const { usuario } = useAdminAuth();
  const location = useLocation();
  const initials = usuario?.nombreCompleto.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join("");
  return <header className="sticky top-0 z-30 flex h-[78px] items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 sm:px-8">
    <div className="flex items-center gap-3">
      <button onClick={onMenu} className="grid h-9 w-9 place-items-center border border-slate-200 lg:hidden" aria-label="Abrir menú" aria-expanded={open} aria-controls="admin-navigation"><AdminIcon name="menu" /></button>
      <div><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">SGIAC · Administración</p><p className="mt-1 text-lg font-bold">{titles[location.pathname.split("/").pop() ?? ""] ?? "Administración"}</p></div>
    </div>
    <div className="flex items-center gap-5">
      <Link to="/" target="_blank" rel="noopener noreferrer" className="hidden items-center gap-2 text-xs font-medium text-slate-500 hover:text-[#2459a9] md:flex">Ver portal público <AdminIcon name="arrow" size={15} /></Link>
      <div className="flex items-center gap-3 sm:border-l sm:border-slate-200 sm:pl-5">
        <span className="grid h-9 w-9 place-items-center bg-[#2459a9] text-xs font-bold text-white" aria-hidden="true">{initials}</span>
        <div className="hidden sm:block"><p className="max-w-44 truncate text-xs font-bold">{usuario?.nombreCompleto}</p><p className="mt-1 max-w-44 truncate text-[9px] uppercase text-slate-400">{usuario?.roles[0] ? ROL_LABEL[usuario.roles[0]] ?? usuario.roles[0] : "Sin rol"}</p></div>
      </div>
    </div>
  </header>;
}
