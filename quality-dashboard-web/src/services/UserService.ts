import axios from "axios";
import { appConfigStore } from "@/stores/appConfig";
import { userAuthenticationStore } from "@/stores/userAuthentication";
import AlertService from "./AlertService";

export default class UserService {
  //
  public static logout(): void {
    localStorage.removeItem("auth_token");
    const userAuthentication = userAuthenticationStore();
    userAuthentication.$patch({
      isAuthenticated: false,
      authToken: "",
    });
  }

  public static async login(username: string, password: string): Promise<void> {
    axios
      .post(
        `${import.meta.env.VITE_APP_BASEPATH_SERVER}/users/login/`,
        {
          password,
          username,
        },
        { headers: UserService.getAuthHeader() }
      )
      .then((response) => {
        localStorage.setItem("auth_token", response.data.token);
        const userAuthentication = userAuthenticationStore();
        userAuthentication.isAuthenticated = true;
        userAuthentication.authToken = response.data.token;
      })
      .catch((err) => {
        AlertService.send({ text: `ERR: Authentication failed: ${err.message}`, type: "error" });
      });
  }

  public static async addUser(username: string, password: string): Promise<void> {
    await axios
      .post(
        `${import.meta.env.VITE_APP_BASEPATH_SERVER}/users`,
        {
          password,
          username,
        },
        { headers: UserService.getAuthHeader() }
      )
      .then((response) => {
        AlertService.send({ text: `User Created`, type: "info" });
      })
      .catch((err) => {
        AlertService.send({ text: `ERR: Error adding user: ${err.message}`, type: "error" });
      });
  }

  public static async updatePassword(password: string): Promise<void> {
    const token = localStorage.getItem("auth_token") as string;
    const tokenData = JSON.parse(atob(token.split(".")[1]));
    axios
      .put(
        `${import.meta.env.VITE_APP_BASEPATH_SERVER}/users/${tokenData.user_id}/password`,
        {
          password,
        },
        { headers: UserService.getAuthHeader() }
      )
      .then((response) => {
        AlertService.send({ text: `Password Changed`, type: "info" });
      })
      .catch((err) => {
        AlertService.send({ text: `ERR: Error changing paasword: ${err.message}`, type: "error" });
      });
  }

  public static async checkAuthentication(): Promise<void> {
    if (localStorage.getItem("auth_token")) {
      const token = localStorage.getItem("auth_token") as string;
      const tokenData = JSON.parse(atob(token.split(".")[1]));
      const userAuthentication = userAuthenticationStore();
      if (new Date() < new Date(tokenData.exp * 1000)) {
        userAuthentication.$patch({
          isAuthenticated: true,
          authToken: token,
        });
      } else {
        localStorage.removeItem("auth_token");
        userAuthentication.$patch({
          isAuthenticated: false,
          authToken: "",
        });
      }
    }
  }

  public static async refreshInitializationStatus(): Promise<void> {
    await axios
      .get(`${import.meta.env.VITE_APP_BASEPATH_SERVER}/users/status/`)
      .then((response) => {
        const appConfig = appConfigStore();
        appConfig.isAuthInitialized = response.data.initialized;
      })
      .catch((err) => {
        AlertService.send({ text: `ERR: Error checking status: ${err.message}`, type: "error" });
      });
  }

  public static getAuthHeader(): any {
    const idToken = localStorage.getItem("auth_token");
    if (idToken) {
      return { Authorization: `Bearer ${idToken}` };
    } else {
      return {};
    }
  }
}
