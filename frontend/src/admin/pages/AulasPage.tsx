import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { aulasApi } from "../../api/aulas.api";
import { Aula } from "../../api/types";
import { AulaFormData, aulaSchema } from "../../utils/validators";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { EstadoBadge } from "../components/EstadoBadge";
import { Modal } from "../components/Modal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { AlertMessage } from "../components/AlertMessage";

export default function AulasPage() {
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Aula | null>(null);
  const [aEliminar, setAEliminar] = useState<Aula | null>(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AulaFormData>({
    resolver: zodResolver(aulaSchema),
    defaultValues: { estado: "disponible" },
  });

  const cargar = () => {
    setCargando(true);
    aulasApi
      .listar()
      .then(({ data }) => setAulas(data.data))
      .finally(() => setCargando(false));
  };

  useEffect(cargar, []);

  const abrirCrear = () => {
    setEditando(null);
    reset({ codigo: "", nombre: "", capacidad: 30, ubicacion: "", estado: "disponible" });
    setModalAbierto(true);
  };

  const abrirEditar = (aula: Aula) => {
    setEditando(aula);
    reset(aula);
    setModalAbierto(true);
  };

  const onSubmit = async (data: AulaFormData) => {
    setError("");
    setGuardando(true);
    try {
      if (editando) {
        await aulasApi.actualizar(editando.idAula, data);
      } else {
        await aulasApi.crear(data);
      }
      setModalAbierto(false);
      cargar();
    } catch {
      setError("No se pudo guardar el aula. Verifica los datos.");
    } finally {
      setGuardando(false);
    }
  };

  const confirmarEliminar = async () => {
    if (!aEliminar) return;
    setGuardando(true);
    try {
      await aulasApi.eliminar(aEliminar.idAula);
      setAEliminar(null);
      cargar();
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Aulas</h1>
          <p className="text-sm text-slate-500">Gestión de aulas y laboratorios de la carrera.</p>
        </div>
        <button className="btn-primary" onClick={abrirCrear}>
          + Nueva aula
        </button>
      </div>

      {cargando ? (
        <LoadingSpinner />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Código</th>
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Capacidad</th>
                <th className="px-4 py-3 font-semibold">Ubicación</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {aulas.map((aula) => (
                <tr key={aula.idAula}>
                  <td className="px-4 py-3 font-medium text-slate-700">{aula.codigo}</td>
                  <td className="px-4 py-3 text-slate-600">{aula.nombre}</td>
                  <td className="px-4 py-3 text-slate-600">{aula.capacidad}</td>
                  <td className="px-4 py-3 text-slate-500">{aula.ubicacion}</td>
                  <td className="px-4 py-3"><EstadoBadge estado={aula.estado} /></td>
                  <td className="px-4 py-3 text-right">
                    <button className="btn-ghost" onClick={() => abrirEditar(aula)}>Editar</button>
                    <button className="btn-ghost text-red-600" onClick={() => setAEliminar(aula)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        title={editando ? "Editar aula" : "Nueva aula"}
        open={modalAbierto}
        onClose={() => setModalAbierto(false)}
      >
        {error && <div className="mb-4"><AlertMessage type="error" message={error} /></div>}
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Código</label>
            <input className="input-field" {...register("codigo")} />
            {errors.codigo && <p className="text-xs text-red-600">{errors.codigo.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Nombre</label>
            <input className="input-field" {...register("nombre")} />
            {errors.nombre && <p className="text-xs text-red-600">{errors.nombre.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Capacidad</label>
              <input type="number" className="input-field" {...register("capacidad")} />
              {errors.capacidad && <p className="text-xs text-red-600">{errors.capacidad.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Estado</label>
              <select className="select-field" {...register("estado")}>
                <option value="disponible">Disponible</option>
                <option value="mantenimiento">Mantenimiento</option>
                <option value="inhabilitada">Inhabilitada</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Ubicación</label>
            <input className="input-field" {...register("ubicacion")} />
            {errors.ubicacion && <p className="text-xs text-red-600">{errors.ubicacion.message}</p>}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModalAbierto(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(aEliminar)}
        title="Eliminar aula"
        message={`¿Seguro que deseas eliminar el aula "${aEliminar?.nombre}"? Esta acción no se puede deshacer.`}
        onCancel={() => setAEliminar(null)}
        onConfirm={confirmarEliminar}
        loading={guardando}
      />
    </div>
  );
}
