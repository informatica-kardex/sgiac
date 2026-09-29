import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminAuthStore } from "../store/adminAuthStore";
import { authApi, LoginPayload, VerifyLoginPayload } from "../api/auth.api";

// Hook centralizado para las acciones de autenticacion del panel
// administrativo. Encapsula las llamadas a la API y la
// sincronizacion con el store global.
export function useAdminAuth() {
  const navigate = useNavigate();
  const { usuario, isAuthenticated, setSession, clearSession } =
    useAdminAuthStore();

  const login = useCallback(
    async (payload: LoginPayload) => {
      const { data } = await authApi.adminLogin(payload);
      if ("requiresTwoFactor" in data.data) return data.data;
      setSession(data.data.usuario, data.data.accessToken);
      navigate(data.data.usuario.debeCambiarPassword ? "/admin/cambiar-password" : "/admin/dashboard");
      return null;
    },
    [navigate, setSession]
  );

  const verifyLogin = useCallback(
    async (payload: VerifyLoginPayload) => {
      const { data } = await authApi.verifyAdminLogin(payload);
      setSession(data.data.usuario, data.data.accessToken);

      if (data.data.usuario.debeCambiarPassword) {
        navigate("/admin/cambiar-password");
      } else {
        navigate("/admin/dashboard");
      }
    },
    [navigate, setSession]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
      navigate("/admin/login");
    }
  }, [clearSession, navigate]);

  return { usuario, isAuthenticated, login, verifyLogin, logout };
}
