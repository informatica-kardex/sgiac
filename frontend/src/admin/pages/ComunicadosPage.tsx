import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { comunicadosApi } from "../../api/comunicados.api";
import { Comunicado } from "../../api/types";
import { ComunicadoFormData, comunicadoSchema } from "../../utils/validators";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { EstadoBadge } from "../components/EstadoBadge";
import { Modal } from "../components/Modal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { AlertMessage } from "../components/AlertMessage";
import { formatFecha } from "../../utils/formatters";

export default function ComunicadosPage() {
  const [comunicados, setComunicados] = useState<Comunicado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Comunicado | null>(null);
  const [aEliminar, setAEliminar] = useState<Comunicado | null>(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ComunicadoFormData>({
    resolver: zodResolver(comunicadoSchema),
    defaultValues: { estado: "borrador" },
  });

  const cargar = () => {
    setCargando(true);
    comunicadosApi
      .listar()
      .then(({ data }) => setComunicados(data.data))
      .finally(() => setCargando(false));
  };

  useEffect(cargar, []);

  const abrirCrear = () => {
    setEditando(null);
    reset({ titulo: "", resumen: "", contenido: "", categoria: "", estado: "borrador" });
    setModalAbierto(true);
  };

  const abrirEditar = (c: Comunicado) => {
    setEditando(c);
    reset(c);
    setModalAbierto(true);
  };

  const onSubmit = async (data: ComunicadoFormData) => {
    setError("");
    setGuardando(true);
    try {
      if (editando) {
        await comunicadosApi.actualizar(editando.idComunicado, data);
      } else {
        await comunicadosApi.crear(data);
      }
      setModalAbierto(false);
      cargar();
    } catch {
      setError("No se pudo guardar el comunicado.");
    } finally {
      setGuardando(false);
    }
  };

  const confirmarEliminar = async () => {
    if (!aEliminar) return;
    setGuardando(true);
    try {
      await comunicadosApi.eliminar(aEliminar.idComunicado);
      setAEliminar(null);
      cargar();
    } finally {
      setGuardando(false);
    }
  };

  const publicar = async (c: Comunicado) => {
    await comunicadosApi.publicar(c.idComunicado);
    cargar();
  };

  const archivar = async (c: Comunicado) => {
    await comunicadosApi.archivar(c.idComunicado);
    cargar();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Comunicados</h1>
          <p className="text-sm text-slate-500">Crea, edita, publica y archiva comunicados oficiales.</p>
        </div>
        <button className="btn-primary" onClick={abrirCrear}>+ Nuevo comunicado</button>
      </div>

      {cargando ? (
        <LoadingSpinner />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Título</th>
                <th className="px-4 py-3 font-semibold">Categoría</th>
                <th className="px-4 py-3 font-semibold">Fecha</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {comunicados.map((c) => (
                <tr key={c.idComunicado}>
                  <td className="px-4 py-3 font-medium text-slate-700">{c.titulo}</td>
                  <td className="px-4 py-3 text-slate-500">{c.categoria}</td>
                  <td className="px-4 py-3 text-slate-500">{formatFecha(c.fechaPublicacion)}</td>
                  <td className="px-4 py-3"><EstadoBadge estado={c.estado} /></td>
                  <td className="px-4 py-3 text-right">
                    {c.estado !== "publicado" && (
                      <button className="btn-ghost text-emerald-700" onClick={() => publicar(c)}>
                        Publicar
                      </button>
                    )}
                    {c.estado !== "archivado" && (
                      <button className="btn-ghost" onClick={() => archivar(c)}>Archivar</button>
                    )}
                    <button className="btn-ghost" onClick={() => abrirEditar(c)}>Editar</button>
                    <button className="btn-ghost text-red-600" onClick={() => setAEliminar(c)}>
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
        title={editando ? "Editar comunicado" : "Nuevo comunicado"}
        open={modalAbierto}
        onClose={() => setModalAbierto(false)}
      >
        {error && <div className="mb-4"><AlertMessage type="error" message={error} /></div>}
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Título</label>
            <input className="input-field" {...register("titulo")} />
            {errors.titulo && <p className="text-xs text-red-600">{errors.titulo.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Categoría</label>
              <input className="input-field" {...register("categoria")} />
              {errors.categoria && <p className="text-xs text-red-600">{errors.categoria.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Estado</label>
              <select className="select-field" {...register("estado")}>
                <option value="borrador">Borrador</option>
                <option value="publicado">Publicado</option>
                <option value="archivado">Archivado</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Resumen</label>
            <textarea className="textarea-field" rows={2} {...register("resumen")} />
            {errors.resumen && <p className="text-xs text-red-600">{errors.resumen.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Contenido</label>
            <textarea className="textarea-field" rows={5} {...register("contenido")} />
            {errors.contenido && <p className="text-xs text-red-600">{errors.contenido.message}</p>}
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
        title="Eliminar comunicado"
        message={`¿Seguro que deseas eliminar "${aEliminar?.titulo}"?`}
        onCancel={() => setAEliminar(null)}
        onConfirm={confirmarEliminar}
        loading={guardando}
      />
    </div>
  );
}
