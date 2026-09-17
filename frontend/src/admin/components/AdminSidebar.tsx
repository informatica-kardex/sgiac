import { NavLink } from "react-router-dom";
import { useAdminAuth } from "../../hooks/useAdminAuth";
import { AdminIcon, AdminIconName } from "./AdminIcon";

const academic = ["ADMINISTRADOR", "SUBADMINISTRADOR_ACADEMICO"];
const attention = ["ADMINISTRADOR", "SUBADMINISTRADOR_ATENCION"];
const admin = ["ADMINISTRADOR"];
const groups: { title: string; items: { key: AdminIconName; label: string; roles: string[] }[] }[] = [
  { title: "", items: [{ key: "dashboard", label: "Dashboard", roles: [...academic, ...attention] }] },
  { title: "Gestión académica", items: [{ key: "aulas", label: "Aulas", roles: academic }, { key: "horarios", label: "Horarios", roles: academic }] },
  { title: "Comunicación", items: [{ key: "comunicados", label: "Comunicados", roles: academic }, { key: "faq", label: "Preguntas frecuentes", roles: academic }, { key: "fichas", label: "Atención", roles: attention }] },
  { title: "Administración", items: [{ key: "reportes", label: "Reportes", roles: admin }, { key: "usuarios", label: "Usuarios", roles: admin }, { key: "roles", label: "Roles y permisos", roles: admin }, { key: "auditoria", label: "Auditoría", roles: admin }, { key: "configuracion", label: "Configuración", roles: admin }] },
];
export function AdminSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { usuario, logout } = useAdminAuth();
  return <>
    {open && <button className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" onClick={onClose} aria-label="Cerrar menú" />}
    <aside id="admin-navigation" className={`admin-sidebar fixed inset-y-0 left-0 z-50 w-[258px] flex-col lg:flex ${open ? "flex" : "hidden"}`}>
      <div className="flex h-[78px] shrink-0 items-center gap-3 border-b border-white/10 px-6">
        <span className="grid h-10 w-10 place-items-center border border-white/20 bg-white/10 text-white"><AdminIcon name="book" size={23} /></span>
        <div><p className="text-xl font-extrabold tracking-wider text-white">SGIAC</p><p className="mt-1 text-[8px] font-semibold uppercase tracking-[.18em] text-slate-300">Carrera de Informática</p></div>
        <button onClick={onClose} className="ml-auto text-slate-300 lg:hidden" aria-label="Cerrar menú"><AdminIcon name="close" /></button>
      </div>
      <nav aria-label="Administración" className="flex-1 overflow-y-auto px-3 py-5">
        {groups.map(group => {
          const items = group.items.filter(item => item.roles.some(role => usuario?.roles.includes(role)));
          if (!items.length) return null;
          return <div key={group.title} className="mb-5 last:mb-0">
            {group.title && <p className="mb-3 px-3 pt-1 text-[9px] font-bold uppercase tracking-[.16em] text-slate-500">{group.title}</p>}
            {items.map(item => <NavLink key={item.key} to={`/admin/${item.key}`} onClick={onClose} className={({ isActive }) => `mb-1 flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium transition ${isActive ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}><AdminIcon name={item.key} />{item.label}</NavLink>)}
          </div>;
        })}
      </nav>
      <div className="shrink-0 border-t border-white/10 p-4"><button onClick={logout} className="flex w-full items-center gap-3 px-3 py-2.5 text-[13px] text-slate-400 transition hover:bg-white/5 hover:text-white"><AdminIcon name="logout" />Cerrar sesión</button></div>
    </aside>
  </>;
}
