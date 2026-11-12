import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { activeAuthStore, clearSession, sessionRevision, updateSessionInfo } from "../auth/session";
import { ApiEnvelope, SessionInfo } from "./types";
import { notifyDataChanged } from "../services/liveUpdates";

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "/api" : "http://localhost:4000/api");
export const axiosClient = axios.create({ baseURL: API_URL, withCredentials: true });
type SessionRequest = InternalAxiosRequestConfig & { _retry?: boolean; _sessionRevision?: number };

axiosClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  (config as SessionRequest)._sessionRevision = sessionRevision();
  const token = activeAuthStore()?.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

type RefreshResponse = ApiEnvelope<{ accessToken: string; session: SessionInfo }>;
let refreshPromise: Promise<{ data: RefreshResponse }> | null = null;

// Una sola renovación por pestaña; Web Locks serializa las cookies entre pestañas.
export function refreshSession() {
  if (!refreshPromise) {
    const request = () => axios.post<RefreshResponse>(`${API_URL}/auth/refresh`, {}, { withCredentials: true, timeout: 15000 });
    refreshPromise = (async () => navigator.locks ? await navigator.locks.request("sgiac-refresh", request) : await request())()
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise!;
}

axiosClient.interceptors.response.use(
  response => {
    const { method = "get", url = "" } = response.config;
    if (["post", "put", "patch", "delete"].includes(method.toLowerCase()) &&
        !url.startsWith("/auth/") && !url.split("?")[0].endsWith("/disponibilidad")) notifyDataChanged();
    return response;
  },
  async (error: AxiosError<{ details?: { code?: string } }>) => {
    const original = error.config as SessionRequest;
    if (error.response?.status !== 401 || !original || !activeAuthStore()) return Promise.reject(error);
    if (original._sessionRevision !== sessionRevision()) return Promise.reject(error);
    if (error.response.data.details?.code === "SESSION_EXPIRED") {
      clearSession(true);
      return Promise.reject(error);
    }
    const url = original.url?.split("?")[0];
    if (original._retry || (url?.startsWith("/auth/") && !["/auth/me", "/auth/activity"].includes(url))) {
      return Promise.reject(error);
    }
    original._retry = true;
    const revision = sessionRevision();
    try {
      const { data } = await refreshSession();
      if (revision !== sessionRevision() || !activeAuthStore()) return Promise.reject(error);
      activeAuthStore()!.getState().setAccessToken(data.data.accessToken);
      updateSessionInfo(data.data.session);
      return axiosClient(original);
    } catch (refreshError) {
      if (revision === sessionRevision() && axios.isAxiosError(refreshError) && refreshError.response?.status === 401) clearSession(true);
      return Promise.reject(refreshError);
    }
  }
);
