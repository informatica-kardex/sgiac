import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useUserAuthStore } from "../store/userAuthStore";
import { authApi, LoginPayload, VerifyLoginPayload } from "../api/auth.api";

// Hook centralizado para las acciones de autenticacion del
// portal institucional (usuarios normales, NO administradores).
// Usa el mismo endpoint /auth/login que ya existia en la API,
// solo que hasta ahora ningun componente lo consumia.
export function useAuth() {
  const navigate = useNavigate();
  const location = useLocation();
  const destino = location.state?.generarFicha === true ? "/usuario/fichas?solicitar=1" : "/usuario/dashboard";
  const { usuario, isAuthenticated, setSession, clearSession } =
    useUserAuthStore();

  const login = useCallback(
    async (payload: LoginPayload) => {
      const { data } = await authApi.login(payload);
      if ("requiresTwoFactor" in data.data) return data.data;
      setSession(data.data.usuario, data.data.accessToken);
      navigate(destino);
      return null;
    },
    [navigate, setSession, destino]
  );

  const verifyLogin = useCallback(
    async (payload: VerifyLoginPayload) => {
      const { data } = await authApi.verifyLogin(payload);
      setSession(data.data.usuario, data.data.accessToken);
      navigate(destino);
    },
    [navigate, setSession, destino]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
      navigate("/login");
    }
  }, [clearSession, navigate]);

  return { usuario, isAuthenticated, login, verifyLogin, logout };
}
