import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { horariosApi } from "../../api/horarios.api";
import { Horario } from "../../api/types";
import { HorarioFormData, horarioSchema } from "../../utils/validators";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { Modal } from "../components/Modal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { AlertMessage } from "../components/AlertMessage";
import { DIAS_SEMANA_LABEL } from "../../utils/formatters";

const DIAS = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"] as const;

export default function HorariosPage() {
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Horario | null>(null);
  const [aEliminar, setAEliminar] = useState<Horario | null>(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<HorarioFormData>({ resolver: zodResolver(horarioSchema) });

  const cargar = () => {
    setCargando(true);
    horariosApi
      .listar()
      .then(({ data }) => setHorarios(data.data))
      .finally(() => setCargando(false));
  };

  useEffect(cargar, []);

  const abrirCrear = () => {
    setEditando(null);
    reset({
      materia: "",
      docente: "",
      aula: "",
      dia: "LUNES",
      horaInicio: "08:00",
      horaFin: "09:30",
      grupo: "A",
    });
    setModalAbierto(true);
  };

  const abrirEditar = (h: Horario) => {
    setEditando(h);
    reset(h);
    setModalAbierto(true);
  };

  const onSubmit = async (data: HorarioFormData) => {
    setError("");
    setGuardando(true);
    try {
      if (editando) {
        await horariosApi.actualizar(editando.idHorario, data);
      } else {
        await horariosApi.crear(data);
      }
      setModalAbierto(false);
      cargar();
    } catch {
      setError("No se pudo guardar el horario. Verifica los datos.");
    } finally {
      setGuardando(false);
    }
  };

  const confirmarEliminar = async () => {
    if (!aEliminar) return;
    setGuardando(true);
    try {
      await horariosApi.eliminar(aEliminar.idHorario);
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
          <h1 className="text-xl font-bold text-slate-800">Horarios</h1>
          <p className="text-sm text-slate-500">
            Calendario semanal administrativo de materias, docentes y aulas.
          </p>
        </div>
        <button className="btn-primary" onClick={abrirCrear}>+ Nuevo horario</button>
      </div>

      {cargando ? (
        <LoadingSpinner />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Día</th>
                <th className="px-4 py-3 font-semibold">Hora</th>
                <th className="px-4 py-3 font-semibold">Materia</th>
                <th className="px-4 py-3 font-semibold">Docente</th>
                <th className="px-4 py-3 font-semibold">Aula</th>
                <th className="px-4 py-3 font-semibold">Grupo</th>
                <th className="px-4 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {horarios
                .slice()
                .sort((a, b) => DIAS.indexOf(a.dia) - DIAS.indexOf(b.dia) || a.horaInicio.localeCompare(b.horaInicio))
                .map((h) => (
                  <tr key={h.idHorario}>
                    <td className="px-4 py-3 text-slate-600">{DIAS_SEMANA_LABEL[h.dia]}</td>
                    <td className="px-4 py-3 text-slate-500">{h.horaInicio} - {h.horaFin}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{h.materia}</td>
                    <td className="px-4 py-3 text-slate-500">{h.docente}</td>
                    <td className="px-4 py-3 text-slate-500">{h.aula}</td>
                    <td className="px-4 py-3 text-slate-500">{h.grupo}</td>
                    <td className="px-4 py-3 text-right">
                      <button className="btn-ghost" onClick={() => abrirEditar(h)}>Editar</button>
                      <button className="btn-ghost text-red-600" onClick={() => setAEliminar(h)}>
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
        title={editando ? "Editar horario" : "Nuevo horario"}
        open={modalAbierto}
        onClose={() => setModalAbierto(false)}
      >
        {error && <div className="mb-4"><AlertMessage type="error" message={error} /></div>}
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Materia</label>
            <input className="input-field" {...register("materia")} />
            {errors.materia && <p className="text-xs text-red-600">{errors.materia.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Docente</label>
              <input className="input-field" {...register("docente")} />
              {errors.docente && <p className="text-xs text-red-600">{errors.docente.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Aula</label>
              <input className="input-field" {...register("aula")} />
              {errors.aula && <p className="text-xs text-red-600">{errors.aula.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Día</label>
              <select className="select-field" {...register("dia")}>
                {DIAS.map((d) => (
                  <option key={d} value={d}>{DIAS_SEMANA_LABEL[d]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Grupo</label>
              <input className="input-field" {...register("grupo")} />
              {errors.grupo && <p className="text-xs text-red-600">{errors.grupo.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Hora inicio</label>
              <input className="input-field" placeholder="08:00" {...register("horaInicio")} />
              {errors.horaInicio && <p className="text-xs text-red-600">{errors.horaInicio.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Hora fin</label>
              <input className="input-field" placeholder="09:30" {...register("horaFin")} />
              {errors.horaFin && <p className="text-xs text-red-600">{errors.horaFin.message}</p>}
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
        title="Eliminar horario"
        message={`¿Seguro que deseas eliminar la clase de "${aEliminar?.materia}"?`}
        onCancel={() => setAEliminar(null)}
        onConfirm={confirmarEliminar}
        loading={guardando}
      />
    </div>
  );
}
