import { FormEvent, useEffect, useState } from "react";
import { AxiosError } from "axios";
import { usersApi } from "../../api/users.api";
import { PermisosChecklist } from "../components/PermisosChecklist";
import { FUNCIONES_SUBADMIN, permisoVigente } from "../../utils/roles";
import { PermisoUsuario, UsuarioAdmin } from "../../api/types";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { EstadoBadge } from "../components/EstadoBadge";
import { Modal } from "../components/Modal";
import { AlertMessage } from "../components/AlertMessage";
import { formatFecha } from "../../utils/formatters";

const subroles = ["SUBADMINISTRADOR"];
const nuevoFormulario = { nombreCompleto: "", correo: "", ci: "" };
function mensajeError(error: unknown) {
  if (error instanceof AxiosError) {
    const data = error.response?.data;
    return data?.details?.[0]?.mensaje || data?.message || "No se pudo completar la operación";
  }
  return "No se pudo completar la operación";
}

export default function UsuariosPage({ tipo }: { tipo: "subadministradores" | "estudiantes" }) {
  const esSubadministradores = tipo === "subadministradores";
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);

  const [cargando, setCargando] = useState(true);
  const [seleccionado, setSeleccionado] = useState<UsuarioAdmin | null>(null);
  const [creando, setCreando] = useState(false);
  const [form, setForm] = useState(nuevoFormulario);
  const [permisos, setPermisos] = useState<PermisoUsuario[]>([]);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState("");
  const [errorModal, setErrorModal] = useState("");
  const [exito, setExito] = useState("");
  const [reseteando, setReseteando] = useState<UsuarioAdmin | null>(null);
  const [ciReset, setCiReset] = useState("");

  const resetearPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!reseteando) return;
    setActualizando(true); setErrorModal(""); setExito("");
    try {
      const { data } = await usersApi.resetearPassword(reseteando.idUsuario, reseteando.ciRegistrado ? undefined : ciReset.trim());
      setExito(`${reseteando.nombreCompleto}: ${data.data.mensaje}`);
      setReseteando(null); setCiReset("");
      await cargar();
    } catch (e) { setErrorModal(mensajeError(e)); }
    finally { setActualizando(false); }
  };

  const cargar = async () => {
    setCargando(true);
    setError("");
    try {
      const u = await usersApi.listar();
      setUsuarios(u.data.data);

    } catch (e) { setError(mensajeError(e)); }
    finally { setCargando(false); }
  };
  useEffect(() => { void cargar(); }, []);

  const cambiarEstado = async (usuario: UsuarioAdmin) => {
    setActualizando(true); setError(""); setExito("");
    try {
      await usersApi.cambiarEstado(usuario.idUsuario, usuario.estado === "activo" ? "inactivo" : "activo");
      setExito("Estado actualizado correctamente.");
      await cargar();
    } catch (e) { setError(mensajeError(e)); }
    finally { setActualizando(false); }
  };

  const guardar = async (event: FormEvent) => {
    event.preventDefault();
    setActualizando(true); setErrorModal(""); setExito("");
    try {
      if (creando) {
        await usersApi.crear({ ...form, permisos });
        setExito(`Subadministrador creado. Primer ingreso: correo ${form.correo.trim()} y su CI como contraseña temporal. El cambio de contraseña es obligatorio.`);
        setCreando(false); setForm(nuevoFormulario);
      } else if (seleccionado) {
        await usersApi.asignarPermisos(seleccionado.idUsuario, permisos);
        setExito("Funciones actualizadas. Los cambios se aplican inmediatamente y los periodos vencen automáticamente.");
        setSeleccionado(null);
      }
      await cargar();
    } catch (e) { setErrorModal(mensajeError(e)); }
    finally { setActualizando(false); }
  };
  const cerrar = () => {
    if (actualizando) return;
    setCreando(false); setSeleccionado(null); setForm(nuevoFormulario); setErrorModal("");
  };
  const usuariosVisibles = usuarios.filter(usuario => {
    if (usuario.roles.includes("ADMINISTRADOR")) return false;
    const esSubadmin = usuario.roles.some(rol => subroles.includes(rol));
    // CONSULTA_INTERNA es el rol asignado al registrarse en el portal estudiantil.
    return esSubadministradores ? esSubadmin : !esSubadmin && usuario.roles.includes("CONSULTA_INTERNA");
  });

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-xl font-bold text-slate-800">{esSubadministradores ? "Subadministradores" : "Estudiantes"}</h1><p className="text-sm text-slate-500">{esSubadministradores ? "Asigna funciones a cada subadministrador, sin límite de tiempo o con un periodo de acceso." : "Gestiona las cuentas registradas en el portal estudiantil, su estado y el restablecimiento de contraseñas."}</p></div>
      {esSubadministradores && <button className="btn-primary" disabled={cargando || actualizando} onClick={() => { setCreando(true); setPermisos([]); setForm(nuevoFormulario); setErrorModal(""); }}>Añadir subadministrador</button>}
    </div>
    {error && <div className="space-y-2"><AlertMessage type="error" message={error} /><button className="btn-ghost" onClick={() => void cargar()}>Reintentar</button></div>}
    {exito && <AlertMessage type="success" message={exito} />}
    {cargando ? <LoadingSpinner /> : <div className="card overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-100 bg-slate-50 text-slate-500"><tr>{["Nombre", "Correo", ...(esSubadministradores ? ["Funciones"] : []), "Registro", "Estado", "Acciones"].map(t => <th key={t} className="px-4 py-3 font-semibold">{t}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{usuariosVisibles.map(u => <tr key={u.idUsuario}>
          <td className="px-4 py-3 font-medium text-slate-700">{u.nombreCompleto}{u.debeCambiarPassword && <span className="mt-1 block text-xs text-amber-700">Cambio de contraseña pendiente</span>}</td>
          <td className="px-4 py-3 text-slate-500">{u.correo}</td>
          {esSubadministradores && <td className="px-4 py-3 text-slate-500">{u.permisos?.length ? <ul className="space-y-2">{u.permisos.map(p => <li key={p.modulo}><span className="font-medium">{FUNCIONES_SUBADMIN[p.modulo] ?? p.modulo}</span><span className="block text-xs">{p.desde && p.hasta ? `${new Date(p.desde).toLocaleString()} — ${new Date(p.hasta).toLocaleString()} (${permisoVigente(p) ? "Vigente" : Date.parse(p.hasta) <= Date.now() ? "Vencido" : "Programado"})` : "Sin límite de tiempo"}</span></li>)}</ul> : "Sin funciones asignadas"}</td>}
          <td className="px-4 py-3 text-slate-500">{formatFecha(u.fechaCreacion)}</td>
          <td className="px-4 py-3"><EstadoBadge estado={u.estado} /></td>
          <td className="px-4 py-3"><div className="flex gap-2">
            {esSubadministradores && <button className="btn-ghost" disabled={actualizando} onClick={() => { setSeleccionado(u); setPermisos(u.permisos ?? []); setErrorModal(""); }}>Asignar funciones</button>}
            <button className="btn-ghost" disabled={actualizando} onClick={() => void cambiarEstado(u)}>{u.estado === "activo" ? "Desactivar" : "Activar"}</button>
            <button className="btn-ghost" disabled={actualizando} onClick={() => { setReseteando(u); setCiReset(""); setErrorModal(""); }}>Restablecer contraseña</button>
          </div></td>
        </tr>)}</tbody>
      </table>
      {!usuariosVisibles.length && !error && <p className="p-6 text-sm text-slate-500">{esSubadministradores ? "No hay subadministradores registrados." : "No hay estudiantes registrados."}</p>}
    </div>}
    <Modal title="Restablecer contraseña al CI" open={Boolean(reseteando)} onClose={() => { if (!actualizando) setReseteando(null); }}>
      <form className="space-y-4" onSubmit={resetearPassword}>
        {errorModal && <AlertMessage type="error" message={errorModal} />}
        <p className="text-sm text-slate-600">Restablecer la contraseña de <strong>{reseteando?.nombreCompleto}</strong> ({reseteando?.correo}). Sus sesiones se cerrarán y deberá cambiar la contraseña temporal al iniciar sesión.</p>
        {reseteando?.ciRegistrado ? <p className="rounded-lg bg-slate-50 p-3 text-sm">Se usará el CI registrado en su ficha de estudiante.</p> : <label className="block text-sm font-medium">{esSubadministradores ? "CI del subadministrador" : "CI del estudiante"}<input required maxLength={30} autoComplete="off" className="input-field mt-1" value={ciReset} disabled={actualizando} onChange={e => setCiReset(e.target.value)} /><span className="mt-1 block text-xs text-slate-500">Verifica su documento e ingresa el CI exacto: será su contraseña temporal.</span></label>}
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" disabled={actualizando} onClick={() => setReseteando(null)}>Cancelar</button><button className="btn-primary" disabled={actualizando}>{actualizando ? "Restableciendo..." : "Confirmar restablecimiento"}</button></div>
      </form>
    </Modal>
    <Modal title={creando ? "Añadir subadministrador" : "Asignar funciones"} open={creando || Boolean(seleccionado)} onClose={cerrar}>
      <form className="space-y-4" onSubmit={guardar}>
        {errorModal && <AlertMessage type="error" message={errorModal} />}
        {creando ? <>
          <label className="block text-sm font-medium">Nombre completo<input required minLength={3} maxLength={150} className="input-field mt-1" value={form.nombreCompleto} disabled={actualizando} onChange={e => setForm({ ...form, nombreCompleto: e.target.value })} /></label>
          <label className="block text-sm font-medium">Correo<input required type="email" maxLength={150} className="input-field mt-1" value={form.correo} disabled={actualizando} onChange={e => setForm({ ...form, correo: e.target.value })} /></label>
          <label className="block text-sm font-medium">CI<input required maxLength={30} autoComplete="off" className="input-field mt-1" value={form.ci} disabled={actualizando} onChange={e => setForm({ ...form, ci: e.target.value })} /></label>
          <p className="text-xs text-slate-500">El CI será la contraseña temporal. Al ingresar con su correo, deberá reemplazarla para usar el sistema.</p>
        </> : <p className="text-sm text-slate-600">Funciones de <strong>{seleccionado?.nombreCompleto}</strong>. Desmarca una función para quitarle el acceso.</p>}
        <PermisosChecklist value={permisos} onChange={setPermisos} disabled={actualizando} />
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" disabled={actualizando} onClick={cerrar}>Cancelar</button><button className="btn-primary" disabled={actualizando}>{actualizando ? "Guardando..." : creando ? "Crear subadministrador" : "Guardar funciones"}</button></div>
      </form>
    </Modal>
  </div>;
}
