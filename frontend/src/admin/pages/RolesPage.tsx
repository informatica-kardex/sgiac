import { useEffect, useState } from "react";
import { rolesApi } from "../../api/roles.api";
import { Rol } from "../../api/types";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ROL_LABEL } from "../../utils/formatters";
import { AdminIcon } from "../components/AdminIcon";

const examples: Rol[] = [
  { idRol: 1, nombre: "ADMINISTRADOR", descripcion: "Administración general, configuración y seguridad del sistema.", estado: "ACTIVO" },
  { idRol: 2, nombre: "SUBADMINISTRADOR_ACADEMICO", descripcion: "Gestión académica de aulas, horarios y comunicación institucional.", estado: "ACTIVO" },
  { idRol: 3, nombre: "SUBADMINISTRADOR_ATENCION", descripcion: "Organización de fichas y atención de estudiantes en Kardex.", estado: "ACTIVO" },
  { idRol: 4, nombre: "CONSULTA_INTERNA", descripcion: "Consulta de información del portal institucional.", estado: "ACTIVO" },
];
const modules = ["Dashboard", "Aulas", "Horarios", "Comunicados", "FAQ", "Atención", "Reportes", "Usuarios", "Roles y permisos", "Auditoría", "Configuración"];
function allowed(role: string, module: string) {
  if (role === "ADMINISTRADOR") return true;
  if (role === "SUBADMINISTRADOR_ACADEMICO") return ["Dashboard", "Aulas", "Horarios", "Comunicados", "FAQ"].includes(module);
  if (role === "SUBADMINISTRADOR_ATENCION") return ["Dashboard", "Atención"].includes(module);
  return false;
}
export default function RolesPage() {
  const [roles, setRoles] = useState<Rol[]>([]);
  const [cargando, setCargando] = useState(true);
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    rolesApi.listar().then(({ data }) => {
      setRoles(data.data.length ? data.data : examples);
      setDemo(!data.data.length);
    }).catch(() => { setRoles(examples); setDemo(true); }).finally(() => setCargando(false));
  }, []);
  return <div className="space-y-6">
    <div><h1 className="text-xl font-bold">Roles y permisos</h1><p className="text-sm text-slate-500">Perfiles de acceso y distribución de permisos por módulo.</p></div>
    {cargando ? <LoadingSpinner /> : <>
      {demo && <div role="status" className="border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><strong>Vista de demostración.</strong> Se muestran roles de ejemplo porque no hay datos disponibles. No se realizan cambios en los permisos reales.</div>}
      <div className="grid gap-4 lg:grid-cols-2">{roles.map(role => <article key={role.idRol} className="card p-6">
        <div className="flex items-start gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center bg-blue-50 text-[#2459a9]"><AdminIcon name="roles" size={22} /></span><div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-bold">{ROL_LABEL[role.nombre] ?? role.nombre}</h2><span className="badge bg-emerald-50 text-emerald-700">{role.estado}</span></div>
          <p className="mt-2 text-xs leading-5 text-slate-500">{role.descripcion}</p>
        </div></div>
      </article>)}</div>
      <section className="card overflow-hidden"><div className="border-b border-slate-200 p-6"><h2 className="flex items-center gap-3 text-sm font-bold"><AdminIcon name="roles" />Matriz de permisos · Demostración</h2><p className="mt-2 text-xs text-slate-500">Vista orientativa de acceso al panel. Esta tabla no modifica ni configura autorizaciones.</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[800px]"><thead><tr><th scope="col" className="px-6 py-4 text-left">Módulo</th>{examples.map(role => <th scope="col" key={role.nombre} className="max-w-44 px-4 py-4 text-center">{ROL_LABEL[role.nombre] ?? role.nombre}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{modules.map(module => <tr key={module}><th scope="row" className="px-6 py-4 text-left !text-xs !normal-case !tracking-normal">{module}</th>{examples.map(role => <td key={role.nombre} className="px-4 text-center">{allowed(role.nombre, module) ? <span className="font-semibold text-emerald-700">Permitido</span> : <span className="text-slate-400">Sin acceso</span>}</td>)}</tr>)}</tbody>
        </table></div>
      </section>
    </>}
  </div>;
}
