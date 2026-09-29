import { useEffect, useState } from "react";
import { rolesApi } from "../../api/roles.api";
import { Rol } from "../../api/types";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ROL_LABEL } from "../../utils/formatters";
import { AdminIcon } from "../components/AdminIcon";
import { MODULOS_ADMIN, FUNCIONES_SUBADMIN, puedeAccederModulo } from "../../utils/roles";
import { AlertMessage } from "../components/AlertMessage";
import { Link } from "react-router-dom";

export default function RolesPage() {
  const [roles, setRoles] = useState<Rol[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    rolesApi.listar().then(({ data }) => {
      setRoles(data.data.filter(r => ["ADMINISTRADOR", "SUBADMINISTRADOR"].includes(r.nombre)));
    }).catch(() => { setError(true); }).finally(() => setCargando(false));
  }, []);
  return <div className="space-y-6">
    <div><h1 className="text-xl font-bold">Roles y permisos</h1><p className="text-sm text-slate-500">Perfiles de acceso y distribución de permisos por módulo.</p></div>
    {cargando ? <LoadingSpinner /> : <>
      {error && <AlertMessage type="error" message="No se pudieron cargar los roles. Recarga la página para reintentar." />}
      {!error && !roles.length && <p className="text-sm text-slate-500">No hay roles activos disponibles.</p>}
      <Link className="btn-primary inline-flex" to="/admin/subadministradores">Gestionar subadministradores</Link>
      <div className="grid gap-4 lg:grid-cols-2">{roles.map(role => <article key={role.idRol} className="card p-6">
        <div className="flex items-start gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center bg-blue-50 text-[#2459a9]"><AdminIcon name="roles" size={22} /></span><div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-bold">{ROL_LABEL[role.nombre] ?? role.nombre}</h2><span className="badge bg-emerald-50 text-emerald-700">{role.estado}</span></div>
          <p className="mt-2 text-xs leading-5 text-slate-500">{role.descripcion}</p>
        </div></div>
      </article>)}</div>
      <section className="card overflow-hidden"><div className="border-b border-slate-200 p-6"><h2 className="flex items-center gap-3 text-sm font-bold"><AdminIcon name="roles" />Matriz de permisos</h2><p className="mt-2 text-xs text-slate-500">Permisos por rol. Asigna funciones y periodos de acceso a cada cuenta desde Subadministradores.</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[800px]"><thead><tr><th scope="col" className="px-6 py-4 text-left">Módulo</th>{roles.map(role => <th scope="col" key={role.nombre} className="max-w-44 px-4 py-4 text-center">{ROL_LABEL[role.nombre] ?? role.nombre}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{Object.entries(MODULOS_ADMIN).map(([key, module]) => <tr key={key}><th scope="row" className="px-6 py-4 text-left !text-xs !normal-case !tracking-normal">{module.label}</th>{roles.map(role => <td key={role.nombre} className="px-4 text-center">{role.nombre === "SUBADMINISTRADOR" && Object.prototype.hasOwnProperty.call(FUNCIONES_SUBADMIN, key) ? <span className="text-blue-700">Según asignación y vigencia</span> : puedeAccederModulo([role.nombre], key) ? <span className="font-semibold text-emerald-700">Permitido</span> : <span className="text-slate-400">Sin acceso</span>}</td>)}</tr>)}</tbody>
        </table></div>
      </section>
    </>}
  </div>;
}
