import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { RoleRepository } from "./role.repository";

const roleRepository = new RoleRepository();

export const roleController = {
  listar: asyncHandler(async (_req, res) => {
    const roles = await roleRepository.findAll();
    return sendSuccess(res, roles, "Roles obtenidos");
  }),
};
