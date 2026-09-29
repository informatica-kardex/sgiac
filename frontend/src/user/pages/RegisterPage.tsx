import { PasswordInput, PasswordStrength } from "../../components/PasswordInput";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { authApi } from "../../api/auth.api";
import { registerSchema, RegisterFormData } from "../../utils/validators";
import { AlertMessage } from "../components/AlertMessage";
import { PrivacyNotice } from "../../components/PrivacyNotice";
import { LoginBackdrop } from "../../components/LoginBrand";
import { EmailVerification } from "../../components/EmailVerification";

const menciones = [
  "Desarrollo de Software e Innovación Tecnológica",
  "Inteligencia Artificial y Ciencias de Datos",
  "Ciencias de la Computación",
  "Informática Industrial",
  "Ingeniería de Sistemas",
  "Redes y TIC",
  "Seguridad de la Información",
];

export default function RegisterPage() {
  const [serverError, setServerError] = useState("");
  const [created, setCreated] = useState(false);
  const [createdMessage, setCreatedMessage] = useState("");
  const [correo, setCorreo] = useState("");
  const [correoEnviado, setCorreoEnviado] = useState(false);
  const [verificado, setVerificado] = useState(false);
  const { register, watch, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<RegisterFormData>({ resolver: zodResolver(registerSchema) });

  async function submit(data: RegisterFormData) {
    setServerError("");
    try {
      const response = await authApi.register(data);
      setCreatedMessage(response.data.data.mensaje);
      setCorreo(response.data.data.correo);
      setCorreoEnviado(response.data.data.correoEnviado);
      setCreated(true);
      reset();
    } catch (error) {
      setServerError(error instanceof AxiosError ? error.response?.data?.message || "No se pudo crear la cuenta. Intenta nuevamente." : "No se pudo crear la cuenta. Intenta nuevamente.");
    }
  }

  function field(name: keyof RegisterFormData, label: string, placeholder: string, type = "text", autoComplete = "off") {
    const Input = type === "password" ? PasswordInput : "input";
    return <div className="space-y-1">
      <label htmlFor={name} className="block text-[13px] font-medium text-slate-800">{label}</label>
      <Input id={name} type={type} placeholder={placeholder} autoComplete={autoComplete}
        className="input-field h-[38px] rounded-md text-xs" disabled={isSubmitting}
        aria-invalid={!!errors[name]} aria-describedby={[name === "correo" ? "correo-ayuda" : "", errors[name] ? `${name}-error` : ""].filter(Boolean).join(" ") || undefined}
        {...register(name, type === "number" ? { valueAsNumber: true } : {})} />
      {name === "contrasena" && <PasswordStrength password={watch("contrasena") ?? ""} />}
      {name === "correo" && <p id="correo-ayuda" className="text-[11px] text-slate-500">Usa tu correo @fcpn.edu.bo o @umsa.bo.</p>}
      {errors[name] && <p id={`${name}-error`} className="text-xs text-red-600">{errors[name]?.message}</p>}
    </div>;
  }

  return <div className="institutional-login registration-page container-public flex justify-center py-10">
    <LoginBackdrop />
    <section className="relative z-10 w-full max-w-[605px] rounded-lg border border-slate-200 bg-white px-5 py-7 sm:px-[29px]">
      {!created && <><h1 className="text-center text-[22px] font-bold leading-7 text-slate-800">Crear cuenta institucional</h1>
      <p className="mt-1 text-center text-xs leading-5 text-slate-500">Completa tus datos personales y académicos para solicitar tu ficha de atención Kardex.</p></>}
      {created ? verificado ? <div className="mt-6 space-y-5">
        <AlertMessage type="success" message="Correo confirmado. Tu cuenta está lista; inicia sesión con tu contraseña." />
        <Link to="/login" className="btn-primary w-full">Ir a iniciar sesión</Link>
      </div> : <EmailVerification correo={correo} initialMessage={createdMessage} initialSent={correoEnviado} onVerified={() => setVerificado(true)} /> : <form onSubmit={handleSubmit(submit)} noValidate className="mt-5">
        {serverError && <div className="mb-5"><AlertMessage type="error" message={serverError} /></div>}
        <fieldset>
          <legend className="mb-3 text-[13px] font-medium text-slate-800">Datos personales</legend>
          <div className="grid grid-cols-1 gap-x-[15px] gap-y-4 sm:grid-cols-2">
            {field("nombres", "Nombres", "Juan Carlos", "text", "given-name")}
            {field("apellidos", "Apellidos", "Pérez Gómez", "text", "family-name")}
            {field("ci", "Cédula de identidad (CI)", "1234567 LP")}
            {field("correo", "Correo institucional", "usuario@fcpn.edu.bo", "email", "email")}
            {field("contrasena", "Contraseña", "••••••••", "password", "new-password")}
            {field("confirmarContrasena", "Confirmar contraseña", "••••••••", "password", "new-password")}
          </div>
        </fieldset>
        <fieldset className="mt-6 border-t border-slate-200 pt-8">
          <legend className="pr-5 text-[13px] font-medium text-slate-800">Datos académicos</legend>
          <div className="grid grid-cols-1 gap-x-[15px] gap-y-4 sm:grid-cols-3">
            {field("ru", "RU (Registro Universitario)", "2023-12345")}
            <div className="min-w-0 space-y-1 sm:col-span-2">
              <label htmlFor="mencion" className="block text-[13px] font-medium text-slate-800">Mención</label>
              <select id="mencion" defaultValue="" required disabled={isSubmitting}
                className="select-field h-[38px] min-w-0 max-w-full rounded-md text-xs"
                aria-invalid={!!errors.mencion} aria-describedby={errors.mencion ? "mencion-error" : undefined}
                {...register("mencion")}>
                <option value="" disabled>Selecciona tu mención</option>
                {menciones.map(mencion => <option key={mencion} value={mencion}>{mencion}</option>)}
              </select>
              {errors.mencion && <p id="mencion-error" className="text-xs text-red-600">{errors.mencion.message}</p>}
            </div>
          </div>
        </fieldset>
        <PrivacyNotice context="registro" />
        <button type="submit" disabled={isSubmitting} className="btn-primary mt-[22px] w-full bg-blue-700 hover:bg-blue-800">{isSubmitting ? "Creando cuenta..." : "Crear cuenta"}</button>
        <p className="mt-4 text-center text-xs text-slate-500">¿Ya tienes una cuenta? <Link to="/login" className="font-medium text-blue-700 hover:underline">Iniciar sesión</Link></p>
      </form>}
    </section>
  </div>;
}
