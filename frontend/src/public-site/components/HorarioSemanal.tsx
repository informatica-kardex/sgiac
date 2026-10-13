import { Horario } from "../../api/types";
import { DIAS_SEMANA_LABEL } from "../../utils/formatters";
import { assistantColor, preuniversityColor } from "../../admin/schedule/semester";

const DIAS_ORDEN = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];

export function HorarioSemanal({ horarios }: { horarios: Horario[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
      {DIAS_ORDEN.map((dia) => {
        const clasesDelDia = horarios
          .filter((h) => h.dia === dia)
          .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));

        return (
          <div key={dia} className="card flex flex-col p-4">
            <p className="mb-3 text-center text-sm font-bold uppercase tracking-wide text-primary-700">
              {DIAS_SEMANA_LABEL[dia]}
            </p>
            <div className="flex flex-1 flex-col gap-2">
              {clasesDelDia.length === 0 && (
                <p className="text-center text-xs text-slate-400">Sin clases</p>
              )}
              {clasesDelDia.map((clase) => (
                <div
                  key={clase.idHorario}
                  style={clase.esAuxiliar ? { backgroundColor: assistantColor } : clase.esCoordinacion ? { backgroundColor: preuniversityColor } : undefined}
                  className="rounded-lg border border-slate-100 bg-slate-50 p-2.5"
                >
                  <p className="text-xs font-bold text-slate-700">
                    {clase.horaInicio} - {clase.horaFin}
                  </p>
                  <p className="text-xs font-medium text-slate-600">{clase.materia}</p>
                  <p className={`text-[11px] ${clase.esAuxiliar || clase.esCoordinacion ? 'text-slate-700' : 'text-slate-400'}`}>
                    {clase.docente} · Aula {clase.aula}{clase.grupo !== 'SIN PARALELO' && ` · Grupo ${clase.grupo}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
