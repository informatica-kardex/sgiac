import { useEffect } from "react";
import { AppRoutes } from "./routes/AppRoutes";
import { useAdminAuthStore } from "./store/adminAuthStore";
import { useUserAuthStore } from "./store/userAuthStore";
import { authApi } from "./api/auth.api";
import { useLiveUpdates } from "./hooks/useLiveUpdates";
import { clearSession, establishSession, sessionRevision } from "./auth/session";
import { SessionTimeout } from "./auth/SessionTimeout";

export default function App() {
  const adminStore = useAdminAuthStore();
  const userStore = useUserAuthStore();
  const session = adminStore.isAuthenticated ? adminStore : userStore;
  useLiveUpdates(session.usuario?.correoVerificado && !session.usuario.debeCambiarPassword ? session.accessToken : null);

  useEffect(() => {
    let active = true;
    const revision = sessionRevision();
    async function restoreSession() {
      try {
        const { data } = await authApi.refresh();
        if (!active || revision !== sessionRevision()) return;
        const meResponse = await authApi.me(data.data.accessToken);
        if (!active || revision !== sessionRevision()) return;
        establishSession({ usuario: meResponse.data.data, ...data.data }, false);
      } catch {
        if (active && revision === sessionRevision()) clearSession(false, false);
      } finally {
        if (active) {
          useAdminAuthStore.getState().setInitializing(false);
          useUserAuthStore.getState().setInitializing(false);
        }
      }
    }
    void restoreSession();
    return () => { active = false; };
  }, []);

  return <><SessionTimeout /><AppRoutes /></>;
}
