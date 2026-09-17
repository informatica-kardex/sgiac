import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { faqApi } from "../../api/faq.api";
import { Faq } from "../../api/types";
import { FaqFormData, faqSchema } from "../../utils/validators";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { EstadoBadge } from "../components/EstadoBadge";
import { Modal } from "../components/Modal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { AlertMessage } from "../components/AlertMessage";

export default function FaqPage() {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Faq | null>(null);
  const [aEliminar, setAEliminar] = useState<Faq | null>(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FaqFormData>({
    resolver: zodResolver(faqSchema),
    defaultValues: { estado: "publicada" },
  });

  const cargar = () => {
    setCargando(true);
    faqApi
      .listar()
      .then(({ data }) => setFaqs(data.data))
      .finally(() => setCargando(false));
  };

  useEffect(cargar, []);

  const abrirCrear = () => {
    setEditando(null);
    reset({ pregunta: "", respuesta: "", categoria: "", estado: "publicada" });
    setModalAbierto(true);
  };

  const abrirEditar = (f: Faq) => {
    setEditando(f);
    reset(f);
    setModalAbierto(true);
  };

  const onSubmit = async (data: FaqFormData) => {
    setError("");
    setGuardando(true);
    try {
      if (editando) {
        await faqApi.actualizar(editando.idFaq, data);
      } else {
        await faqApi.crear(data);
      }
      setModalAbierto(false);
      cargar();
    } catch {
      setError("No se pudo guardar la pregunta frecuente.");
    } finally {
      setGuardando(false);
    }
  };

  const confirmarEliminar = async () => {
    if (!aEliminar) return;
    setGuardando(true);
    try {
      await faqApi.eliminar(aEliminar.idFaq);
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
          <h1 className="text-xl font-bold text-slate-800">Preguntas frecuentes</h1>
          <p className="text-sm text-slate-500">Gestiona el contenido de FAQ del portal público.</p>
        </div>
        <button className="btn-primary" onClick={abrirCrear}>+ Nueva pregunta</button>
      </div>

      {cargando ? (
        <LoadingSpinner />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Pregunta</th>
                <th className="px-4 py-3 font-semibold">Categoría</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {faqs.map((f) => (
                <tr key={f.idFaq}>
                  <td className="max-w-md px-4 py-3 font-medium text-slate-700">{f.pregunta}</td>
                  <td className="px-4 py-3 text-slate-500">{f.categoria}</td>
                  <td className="px-4 py-3"><EstadoBadge estado={f.estado} /></td>
                  <td className="px-4 py-3 text-right">
                    <button className="btn-ghost" onClick={() => abrirEditar(f)}>Editar</button>
                    <button className="btn-ghost text-red-600" onClick={() => setAEliminar(f)}>
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
        title={editando ? "Editar pregunta" : "Nueva pregunta"}
        open={modalAbierto}
        onClose={() => setModalAbierto(false)}
      >
        {error && <div className="mb-4"><AlertMessage type="error" message={error} /></div>}
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Pregunta</label>
            <input className="input-field" {...register("pregunta")} />
            {errors.pregunta && <p className="text-xs text-red-600">{errors.pregunta.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Respuesta</label>
            <textarea className="textarea-field" rows={4} {...register("respuesta")} />
            {errors.respuesta && <p className="text-xs text-red-600">{errors.respuesta.message}</p>}
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
                <option value="publicada">Publicada</option>
                <option value="borrador">Borrador</option>
              </select>
            </div>
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
        title="Eliminar pregunta"
        message="¿Seguro que deseas eliminar esta pregunta frecuente?"
        onCancel={() => setAEliminar(null)}
        onConfirm={confirmarEliminar}
        loading={guardando}
      />
    </div>
  );
}
