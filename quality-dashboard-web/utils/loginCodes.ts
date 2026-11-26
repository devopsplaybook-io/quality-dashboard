import {
  LoginCodeService,
  type LoginCodeServiceOptions,
} from "@devopsplaybook.io/common-web/services/LoginCodeService";
import { AuthService } from "~~/services/AuthService";

// No baseUrl: the service defaults to Config.SERVER_URL + "/users/login-codes"
// (common-web Config.SERVER_URL is "/api"), i.e. /api/users/login-codes.
export function createLoginCodeService(
  overrides: LoginCodeServiceOptions = {},
): LoginCodeService {
  return new LoginCodeService({
    getAuthHeader: () => AuthService.getAuthHeader(),
    onSession: (token) => AuthService.saveToken(token),
    ...overrides,
  });
}

export async function isLoginCodeAvailable(
  service: LoginCodeService,
): Promise<boolean> {
  try {
    const capabilities = await service.capabilities();
    return capabilities.enabled === true && capabilities.available === true;
  } catch {
    return false; // routes absent (flag off) / network error -> hide the UI
  }
}
