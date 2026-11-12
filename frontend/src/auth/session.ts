import { create } from "zustand";
import { AuthResponse, SessionInfo, UsuarioSesion } from "../api/types";
import { useAdminAuthStore } from "../store/adminAuthStore";
import { useUserAuthStore } from "../store/userAuthStore";
import { esRolAdministrativo } from "../utils/roles";

export const useSessionInfo = create<{ session: SessionInfo | null; expired: boolean }>(() => ({ session: null, expired: false }));
let revision = 0;
export const sessionRevision = () => revision;
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("sgiac-session") : null;

export function activeAuthStore() {
  if (useAdminAuthStore.getState().isAuthenticated) return useAdminAuthStore;
  if (useUserAuthStore.getState().isAuthenticated) return useUserAuthStore;
  return null;
}

export function clearSession(expired = false, broadcast = true) {
  const id = useSessionInfo.getState().session?.id;
  revision++;
  useAdminAuthStore.getState().clearSession();
  useUserAuthStore.getState().clearSession();
  useSessionInfo.setState({ session: null, expired });
  if (broadcast) channel?.postMessage({ type: "logout", id });
}

export function sessionHome(usuario: UsuarioSesion) {
  const prefix = esRolAdministrativo(usuario.roles) ? "/admin" : "/usuario";
  return `${prefix}/${!usuario.correoVerificado ? "verificar-correo" : usuario.debeCambiarPassword ? "cambiar-password" : "dashboard"}`;
}

export function establishSession(data: AuthResponse, broadcast = true) {
  if (!data.session || !Number.isSafeInteger(data.session.id) || data.session.id <= 0 ||
      !Number.isFinite(data.session.expiresAt) || data.session.expiresAt <= Date.now()) {
    throw new Error("La sesión no tiene un vencimiento válido. Inicia sesión nuevamente.");
  }
  revision++;
  const admin = esRolAdministrativo(data.usuario.roles);
  (admin ? useUserAuthStore : useAdminAuthStore).getState().clearSession();
  (admin ? useAdminAuthStore : useUserAuthStore).getState().setSession(data.usuario, data.accessToken);
  useSessionInfo.setState({ session: data.session, expired: false });
  if (broadcast) channel?.postMessage({ type: "login", id: data.session.id });
}

export function updateSessionInfo(session: SessionInfo, broadcast = true) {
  const current = useSessionInfo.getState().session;
  if (current?.id !== session.id || !activeAuthStore()) return;
  useSessionInfo.setState({ session: { ...session, expiresAt: Math.max(current.expiresAt, session.expiresAt) } });
  if (broadcast) channel?.postMessage({ type: "activity", session });
}

if (channel) channel.onmessage = ({ data }) => {
  const current = useSessionInfo.getState().session;
  if (!current) return;
  if (data.type === "activity") updateSessionInfo(data.session, false);
  if ((data.type === "logout" && data.id === current.id) || (data.type === "login" && data.id !== current.id)) {
    clearSession(true, false);
  }
};
