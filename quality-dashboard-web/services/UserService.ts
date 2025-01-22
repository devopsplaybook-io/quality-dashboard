import axios from "axios";
import Config from "./Config";
import { AuthService } from "~~/services/AuthService";

const AUTH_TOKEN_KEY = "auth_token";

export class UserService {
  //
  public static async isInitialized(): Promise<boolean> {
    return (await axios.get(`${(await Config.get()).SERVER_URL}/users/status/initialization`)).data.initialized;
  }
  
  public static async login(name: String, password: String): Promise<any> {
    return await axios.post(
      `${(await Config.get()).SERVER_URL}/users/session`,
      { name, password },
      await AuthService.getAuthHeader()
    );
  }
}
