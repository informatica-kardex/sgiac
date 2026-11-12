import { useEffect, useState } from "react";
import { AxiosError } from "axios";
import { estudiantesApi, PerfilEstudiante } from "../../api/estudiantes.api";
import { useAuth } from "../../hooks/useAuth";
import { AccountSettingsLayout } from "../../components/AccountSettingsLayout";
import { ProfileDetails } from "../../components/ProfileDetails";
import { PasswordSettings } from "../../components/PasswordSettings";
import { LoadingSpinner } from "../../public-site/components/LoadingSpinner";
import { AlertMessage } from "../components/AlertMessage";

export default function ProfilePage() {
  const { usuario } = useAuth();
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
  if (!usuario) return null;
  return <AccountSettingsLayout usuario={usuario} student profile={
    loading ? <LoadingSpinner label="Cargando tu perfil..." /> : error ? <><AlertMessage type="error" message={error} /><button className="btn-secondary mt-4" onClick={() => setAttempt(v => v + 1)}>Reintentar</button></> : perfil &&
    <ProfileDetails usuario={usuario} estudiante={perfil} onSaved={setPerfil} />
  } password={<PasswordSettings student />} />;
}
