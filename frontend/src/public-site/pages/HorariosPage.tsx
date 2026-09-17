import { useEffect, useState } from "react";
import { horariosApi } from "../../api/horarios.api";
import { Horario } from "../../api/types";
import { HorarioSemanal } from "../components/HorarioSemanal";
import { LoadingSpinner } from "../components/LoadingSpinner";

export default function HorariosPage() {
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    horariosApi
      .listar()
      .then(({ data }) => setHorarios(data.data))
      .finally(() => setCargando(false));
  }, []);

  return (
    <div className="container-public py-14">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-800">Horarios</h1>
        <p className="mt-1 text-slate-500">
          Calendario semanal de clases, de lunes a sábado.
        </p>
      </div>

      {cargando ? (
        <LoadingSpinner label="Cargando horarios..." />
      ) : (
        <HorarioSemanal horarios={horarios} />
      )}
    </div>
  );
}
