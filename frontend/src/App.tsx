import { useEffect } from "react";
import { AppRoutes } from "./routes/AppRoutes";
import { useAdminAuthStore } from "./store/adminAuthStore";
import { useUserAuthStore } from "./store/userAuthStore";
import { authApi } from "./api/auth.api";
import { esRolAdministrativo } from "./utils/roles";

export default function App() {
  const adminStore = useAdminAuthStore();
  const userStore = useUserAuthStore();

  // Al montar la app, intenta restaurar la sesion (cualquiera de
  // las dos) usando la cookie httpOnly de refresh token, si existe.
  // El portal publico no requiere sesion, por lo que esto no afecta
  // a un visitante sin cuenta.
  //
  // Ambos flujos de login (institucional y administrativo) comparten
  // el mismo mecanismo de JWT/cookies en el backend, pero en el
  // frontend se mantienen en stores separados (adminAuthStore vs
  // userAuthStore) para no mezclar el estado de una sesion con la
  // otra. Por eso, al restaurar, se decide a que store pertenece la
  // sesion segun los roles que devuelve /auth/me: si tiene algun rol
  // administrativo va a adminAuthStore (comportamiento identico al
  // que ya existia para un administrador real); si no, va a
  // userAuthStore (usuario institucional).
  useEffect(() => {
    async function restoreSession() {
      try {
        const { data } = await authApi.refresh();
        const meResponse = await authApi.me();
        const usuario = meResponse.data.data;

        if (esRolAdministrativo(usuario.roles)) {
          adminStore.setSession(usuario, data.data.accessToken);
          userStore.clearSession();
        } else {
          userStore.setSession(usuario, data.data.accessToken);
          adminStore.clearSession();
        }
      } catch {
        adminStore.clearSession();
        userStore.clearSession();
      } finally {
        adminStore.setInitializing(false);
        userStore.setInitializing(false);
      }
    }

    restoreSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <AppRoutes />;
}
