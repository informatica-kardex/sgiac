import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { fichasApi } from "../../api/fichas.api";
import { FichaPublicaFormData, fichaPublicaSchema } from "../../utils/validators";

export default function AtencionPage() {
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FichaPublicaFormData>({ resolver: zodResolver(fichaPublicaSchema) });

  const onSubmit = async (data: FichaPublicaFormData) => {
    setError("");
    setEnviando(true);
    try {
      await fichasApi.crear(data);
      setEnviado(true);
      reset();
    } catch (err) {
      const message =
        err instanceof AxiosError ? err.response?.data?.message : undefined;
      setError(message || "No se pudo registrar tu solicitud. Intenta nuevamente.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="container-public py-14">
      <div className="mb-10 max-w-2xl">
        <h1 className="text-3xl font-extrabold text-slate-800">Atención Kardex</h1>
        <p className="mt-1 text-slate-500">
          Información de contacto y formulario para generar tu ficha de
          atención en línea (kardex, certificados, trámites académicos).
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        <div className="card space-y-5 p-6 lg:col-span-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Horario</p>
            <p className="text-slate-700">Lunes a viernes, 8:00 - 16:00</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Ubicación</p>
            <p className="text-slate-700">Bloque C, planta baja — Carrera de Informática</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Contacto</p>
            <p className="text-slate-700">kardex.informatica@universidad.edu.bo</p>
            <p className="text-slate-700">Tel. (591) 2-2xx-xxxx</p>
          </div>
          <div className="rounded-lg bg-primary-50 p-3 text-sm text-primary-800">
            Las solicitudes en línea se reciben las 24 horas. El tiempo estimado
            de respuesta es de 3 a 5 días hábiles.
          </div>
        </div>

        <div className="card p-6 lg:col-span-3">
          <h2 className="mb-4 text-lg font-bold text-slate-800">
            Solicitar ficha de atención
          </h2>

          {enviado ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
              Tu solicitud fue registrada correctamente. Te contactaremos al
              correo proporcionado en los próximos días hábiles.
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Nombre completo</label>
                <input className="input-field" {...register("solicitante")} />
                {errors.solicitante && (
                  <p className="text-xs text-red-600">{errors.solicitante.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Correo de contacto</label>
                <input className="input-field" type="email" {...register("correo")} />
                {errors.correo && <p className="text-xs text-red-600">{errors.correo.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Motivo</label>
                <input
                  className="input-field"
                  placeholder="Ej. Solicitud de Kardex"
                  {...register("motivo")}
                />
                {errors.motivo && <p className="text-xs text-red-600">{errors.motivo.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Detalle de la solicitud</label>
                <textarea className="textarea-field" rows={4} {...register("detalle")} />
                {errors.detalle && <p className="text-xs text-red-600">{errors.detalle.message}</p>}
              </div>

              <button type="submit" className="btn-primary" disabled={enviando}>
                {enviando ? "Enviando..." : "Enviar solicitud"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
