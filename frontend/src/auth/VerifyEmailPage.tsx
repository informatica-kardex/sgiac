import { useNavigate } from "react-router-dom";
import { EmailVerification } from "../components/EmailVerification";
import { useAdminAuthStore } from "../store/adminAuthStore";
import { useUserAuthStore } from "../store/userAuthStore";
import { authApi } from "../api/auth.api";

export default function VerifyEmailPage({ admin = false }: { admin?: boolean }) {
  const adminSession = useAdminAuthStore();
  const userSession = useUserAuthStore();
  const session = admin ? adminSession : userSession;
  const navigate = useNavigate();
  if (!session.usuario) return null;

  const continuar = async () => {
    const { data } = await authApi.me();
    const token = (admin ? useAdminAuthStore : useUserAuthStore).getState().accessToken;
    if (!token) { navigate(admin ? "/admin/login" : "/login", { replace: true }); return; }
    session.setSession(data.data, token);
    navigate(admin ? data.data.debeCambiarPassword ? "/admin/cambiar-password" : "/admin/dashboard" : "/usuario/dashboard", { replace: true });
  };
  const salir = async () => {
    try { await authApi.logout(); }
    finally { session.clearSession(); navigate(admin ? "/admin/login" : "/login", { replace: true }); }
  };
  return <div className={admin ? "card space-y-5 p-8" : "card mx-auto my-10 max-w-md space-y-5 p-8"}>
    <EmailVerification correo={session.usuario.correo} autoSend onVerified={continuar} />
    {session.usuario.debeCambiarPassword && <p className="text-xs text-slate-500">Después de confirmar el correo podrás cambiar tu contraseña temporal.</p>}
    <button className="btn-ghost w-full" onClick={() => void salir()}>Cerrar sesión</button>
  </div>;
}
