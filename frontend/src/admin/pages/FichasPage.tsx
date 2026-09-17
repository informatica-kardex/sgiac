import { useEffect, useState } from "react";
import { fichasApi } from "../../api/fichas.api";
import { EstadoFicha, FichaAtencion } from "../../api/types";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { EstadoBadge } from "../components/EstadoBadge";
import { Modal } from "../components/Modal";
import { formatFechaHora } from "../../utils/formatters";
import { useAdminAuthStore } from "../../store/adminAuthStore";

const ESTADOS: EstadoFicha[] = ["pendiente", "en_proceso", "atendida", "rechazada"];

export default function FichasPage() {
  const { usuario } = useAdminAuthStore();
  const [fichas, setFichas] = useState<FichaAtencion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [seleccionada, setSeleccionada] = useState<FichaAtencion | null>(null);
  const [actualizando, setActualizando] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");

  const cargar = () => {
    setCargando(true);
    fichasApi
      .listar()
      .then(({ data }) => setFichas(data.data))
      .finally(() => setCargando(false));
  };

  useEffect(cargar, []);

  const cambiarEstado = async (estado: EstadoFicha) => {
    if (!seleccionada) return;
    setActualizando(true);
    try {
      await fichasApi.actualizar(seleccionada.idFicha, {
        estado,
        atendidoPor: usuario?.roles?.[0],
      });
      setSeleccionada(null);
      cargar();
    } finally {
      setActualizando(false);
    }
  };

  const filtradas =
    filtroEstado === "todos" ? fichas : fichas.filter((f) => f.estado === filtroEstado);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Atención Kardex</h1>
        <p className="text-sm text-slate-500">
          Bandeja de fichas de atención generadas desde el portal público.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {["todos", ...ESTADOS].map((estado) => (
          <button
            key={estado}
            onClick={() => setFiltroEstado(estado)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition ${
              filtroEstado === estado
                ? "bg-primary-700 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {estado.replace("_", " ")}
          </button>
        ))}
      </div>

      {cargando ? (
        <LoadingSpinner />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Solicitante</th>
                <th className="px-4 py-3 font-semibold">Motivo</th>
                <th className="px-4 py-3 font-semibold">Fecha</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtradas.map((f) => (
                <tr key={f.idFicha}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-700">{f.solicitante}</p>
                    <p className="text-xs text-slate-400">{f.correo}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{f.motivo}</td>
                  <td className="px-4 py-3 text-slate-500">{formatFechaHora(f.fechaSolicitud)}</td>
                  <td className="px-4 py-3"><EstadoBadge estado={f.estado} /></td>
                  <td className="px-4 py-3 text-right">
                    <button className="btn-ghost" onClick={() => setSeleccionada(f)}>
                      Gestionar
                    </button>
                  </td>
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    No hay fichas en este estado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        title="Gestionar ficha de atención"
        open={Boolean(seleccionada)}
        onClose={() => setSeleccionada(null)}
      >
        {seleccionada && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Solicitante</p>
              <p className="text-sm text-slate-700">{seleccionada.solicitante} — {seleccionada.correo}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Motivo</p>
              <p className="text-sm text-slate-700">{seleccionada.motivo}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Detalle</p>
              <p className="text-sm text-slate-600">{seleccionada.detalle}</p>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Cambiar estado</p>
              <div className="flex flex-wrap gap-2">
                {ESTADOS.map((estado) => (
                  <button
                    key={estado}
                    disabled={actualizando}
                    onClick={() => cambiarEstado(estado)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
                      seleccionada.estado === estado
                        ? "bg-primary-700 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {estado.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
