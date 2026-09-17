import { useEffect, useState } from "react";
import { usersApi } from "../../api/users.api";
import { rolesApi } from "../../api/roles.api";
import { Rol, UsuarioAdmin } from "../../api/types";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { EstadoBadge } from "../components/EstadoBadge";
import { Modal } from "../components/Modal";
import { formatFecha, ROL_LABEL } from "../../utils/formatters";

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [cargando, setCargando] = useState(true);
  const [seleccionado, setSeleccionado] = useState<UsuarioAdmin | null>(null);
  const [actualizando, setActualizando] = useState(false);

  const cargar = () => {
    setCargando(true);
    Promise.all([usersApi.listar(), rolesApi.listar()])
      .then(([u, r]) => {
        setUsuarios(u.data.data);
        setRoles(r.data.data);
      })
      .finally(() => setCargando(false));
  };

  useEffect(cargar, []);

  const cambiarEstado = async (usuario: UsuarioAdmin) => {
    setActualizando(true);
    try {
      const nuevoEstado = usuario.estado === "activo" ? "inactivo" : "activo";
      await usersApi.cambiarEstado(usuario.idUsuario, nuevoEstado);
      cargar();
    } finally {
      setActualizando(false);
    }
  };

  const asignarRol = async (idRol: number) => {
    if (!seleccionado) return;
    setActualizando(true);
    try {
      await usersApi.asignarRol(seleccionado.idUsuario, idRol);
      setSeleccionado(null);
      cargar();
    } finally {
      setActualizando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Usuarios</h1>
        <p className="text-sm text-slate-500">
          Administra las cuentas registradas y sus roles asignados.
        </p>
      </div>

      {cargando ? (
        <LoadingSpinner />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Correo</th>
                <th className="px-4 py-3 font-semibold">Roles</th>
                <th className="px-4 py-3 font-semibold">Registro</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usuarios.map((u) => (
                <tr key={u.idUsuario}>
                  <td className="px-4 py-3 font-medium text-slate-700">{u.nombreCompleto}</td>
                  <td className="px-4 py-3 text-slate-500">{u.correo}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {u.roles.map((r) => ROL_LABEL[r] ?? r).join(", ") || "Sin rol"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatFecha(u.fechaCreacion)}</td>
                  <td className="px-4 py-3"><EstadoBadge estado={u.estado} /></td>
                  <td className="px-4 py-3 text-right">
                    <button className="btn-ghost" onClick={() => setSeleccionado(u)}>
                      Asignar rol
                    </button>
                    <button
                      className="btn-ghost"
                      disabled={actualizando}
                      onClick={() => cambiarEstado(u)}
                    >
                      {u.estado === "activo" ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        title="Asignar rol"
        open={Boolean(seleccionado)}
        onClose={() => setSeleccionado(null)}
      >
        {seleccionado && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Selecciona el rol a asignar a{" "}
              <span className="font-semibold">{seleccionado.nombreCompleto}</span>:
            </p>
            <div className="flex flex-col gap-2">
              {roles.map((rol) => (
                <button
                  key={rol.idRol}
                  disabled={actualizando}
                  onClick={() => asignarRol(rol.idRol)}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:border-primary-300 hover:bg-primary-50"
                >
                  {ROL_LABEL[rol.nombre] ?? rol.nombre}
                  {rol.descripcion && (
                    <span className="block text-xs font-normal text-slate-400">
                      {rol.descripcion}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
