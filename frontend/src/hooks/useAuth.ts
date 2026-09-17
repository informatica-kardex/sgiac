import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useUserAuthStore } from "../store/userAuthStore";
import { authApi, LoginPayload } from "../api/auth.api";

// Hook centralizado para las acciones de autenticacion del
// portal institucional (usuarios normales, NO administradores).
// Usa el mismo endpoint /auth/login que ya existia en la API,
// solo que hasta ahora ningun componente lo consumia.
export function useAuth() {
  const navigate = useNavigate();
  const { usuario, isAuthenticated, setSession, clearSession } =
    useUserAuthStore();

  const login = useCallback(
    async (payload: LoginPayload) => {
      const { data } = await authApi.login(payload);
      setSession(data.data.usuario, data.data.accessToken);
      navigate("/usuario/dashboard");
    },
    [navigate, setSession]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
      navigate("/login");
    }
  }, [clearSession, navigate]);

  return { usuario, isAuthenticated, login, logout };
}
