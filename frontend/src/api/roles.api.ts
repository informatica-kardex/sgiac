import { axiosClient } from "./axiosClient";
import { ApiEnvelope, Rol } from "./types";

export const rolesApi = {
  listar: () => axiosClient.get<ApiEnvelope<Rol[]>>("/roles"),
};
