import { useAdminAuthStore } from "../store/adminAuthStore";
import { useAuth } from "./useAuth";

export function useAdminAuth() {
  const { usuario, isAuthenticated } = useAdminAuthStore();
  const { login, verifyLogin, logout } = useAuth();
  return { usuario, isAuthenticated, login, verifyLogin, logout };
}
