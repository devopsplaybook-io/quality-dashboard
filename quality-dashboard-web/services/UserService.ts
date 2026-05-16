import axios from "axios";
import Config from "./Config";

const AUTH_TOKEN_KEY = "auth_token";

export class UserService {
  //
  public static async isInitialized(): Promise<boolean> {
    return (
      await axios.get(
        `${(await Config.get()).SERVER_URL}/users/status/initialization`,
      )
    ).data.initialized;
  }

  public static async login(name: string, password: string): Promise<any> {
    const config = await Config.get();
    return axios.post(`${config.SERVER_URL}/users/session`, {
      name,
      password,
    });
  }

  public static async register(name: string, password: string): Promise<any> {
    const config = await Config.get();
    return axios.post(`${config.SERVER_URL}/users`, {
      name,
      password,
    });
  }
}
