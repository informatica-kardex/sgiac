import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { useAdminAuthStore } from "../store/adminAuthStore";
import { useUserAuthStore } from "../store/userAuthStore";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export const axiosClient = axios.create({
  baseURL: API_URL,
  withCredentials: true, // permite el envio de cookies httpOnly
});

// Devuelve el store de la sesion actualmente activa. Solo una de
// las dos deberia estar autenticada a la vez (admin o usuario
// institucional); si por algun motivo ninguna lo esta, se sigue
// dependiendo de la cookie httpOnly (withCredentials), que el
// backend ya acepta como respaldo.
function storeDeSesionActiva() {
  if (useAdminAuthStore.getState().isAuthenticated) return useAdminAuthStore;
  if (useUserAuthStore.getState().isAuthenticated) return useUserAuthStore;
  return null;
}

// Adjunta el access token en memoria (Zustand) de la sesion activa
// a cada request. Antes solo miraba adminAuthStore; ahora tambien
// reconoce la sesion institucional sin cambiar el comportamiento
// para un administrador autenticado.
axiosClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const activeStore = storeDeSesionActiva();
  const token = activeStore?.getState().accessToken;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let pendingQueue: Array<() => void> = [];

// Intercepta 401 y trata de renovar la sesion automaticamente
// usando /auth/refresh (basado en la cookie httpOnly de refresh).
axiosClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/refresh") &&
      !originalRequest.url?.includes("/auth/login") &&
      !originalRequest.url?.includes("/auth/admin/login")
    ) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          pendingQueue.push(() => resolve(axiosClient(originalRequest)));
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axiosClient.post("/auth/refresh");
        const activeStore = storeDeSesionActiva() ?? useAdminAuthStore;
        activeStore.getState().setAccessToken(data.data.accessToken);
        pendingQueue.forEach((cb) => cb());
        pendingQueue = [];
        return axiosClient(originalRequest);
      } catch (refreshError) {
        useAdminAuthStore.getState().clearSession();
        useUserAuthStore.getState().clearSession();
        pendingQueue = [];
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
