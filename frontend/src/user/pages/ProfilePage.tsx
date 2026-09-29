import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AxiosError } from "axios";
import { estudiantesApi, PerfilEstudiante } from "../../api/estudiantes.api";
import { useAuth } from "../../hooks/useAuth";
import { TwoFactorSettings } from "../../components/TwoFactorSettings";
import { LoadingSpinner } from "../../public-site/components/LoadingSpinner";
import { AlertMessage } from "../components/AlertMessage";

export default function ProfilePage() {
  const { usuario, logout } = useAuth();
  const [perfil, setPerfil] = useState<PerfilEstudiante | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    estudiantesApi.perfil().then(({ data }) => { if (active) setPerfil(data.data); })
      .catch(e => { if (active) setError(e instanceof AxiosError ? e.response?.data?.message || "No se pudo cargar tu perfil." : "No se pudo cargar tu perfil."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  return <div className="container-public max-w-4xl space-y-7 py-10">
    <Link to="/usuario/dashboard" className="text-sm font-semibold text-emerald-700">← Volver a mi inicio</Link>
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-bold text-slate-800">Mi perfil</h1><p className="mt-2 text-slate-500">Tus datos personales, académicos y seguridad de la cuenta.</p></div><button onClick={() => { void logout().catch(() => {}); }} className="btn-secondary">Cerrar sesión</button></div>
    <section className="card p-6 sm:p-8">
      <h2 className="mb-6 text-xl font-bold text-slate-800">{usuario?.nombreCompleto}</h2>
      {loading ? <LoadingSpinner label="Cargando tu perfil..." /> : error ? <><AlertMessage type="error" message={error} /><button className="btn-secondary mt-4" onClick={() => setAttempt(v => v + 1)}>Reintentar</button></> : perfil &&
        <dl className="grid gap-6 sm:grid-cols-2">{[["Nombres", perfil.nombres], ["Apellidos", perfil.apellidos], ["Cédula de identidad", perfil.ci], ["Registro universitario (RU)", perfil.ru], ["Mención", perfil.mencion || "Sin registrar"], ["Correo institucional", perfil.correo]].map(([label, value]) => <div key={label}><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-2 break-words font-medium text-slate-800">{value}</dd></div>)}</dl>}
    </section>
    <TwoFactorSettings />
  </div>;
}
