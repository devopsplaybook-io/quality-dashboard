import axios from "axios";
import UserService from "./UserService";
import { appConfigStore } from "@/stores/appConfig";
import AlertService from "./AlertService";

export default class AppConfigService {
  //
  public static async refresh(): Promise<any> {
    try {
      const response = await axios.get(`${import.meta.env.VITE_APP_BASEPATH_SERVER}/settings/`, {
        headers: UserService.getAuthHeader(),
      });
      const appConfig = appConfigStore();
      appConfig.$patch({
        isDashboardPublic: response.data.isDashboardPublic,
        uploadToken: response.data.uploadToken,
      });
    } catch (err: any) {
      AlertService.send({ text: `ERR: Error getting settings: ${err.message}`, type: "error" });
    }
  }

  public static async update(config: any): Promise<void> {
    await axios
      .put(
        `${import.meta.env.VITE_APP_BASEPATH_SERVER}/settings`,
        {
          isDashboardPublic: config.isDashboardPublic,
          uploadToken: config.uploadToken,
        },
        {
          headers: UserService.getAuthHeader(),
        }
      )
      .then((response) => {
        AlertService.send({ text: `Settings Updated`, type: "info" });
        AppConfigService.refresh();
      })
      .catch((err: any) => {
        AlertService.send({ text: `ERR: Error getting settings: ${err.message}`, type: "error" });
      });
  }
}
