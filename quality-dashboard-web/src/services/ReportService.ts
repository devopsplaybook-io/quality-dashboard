import axios from "axios";
import UserService from "./UserService";
import AlertService from "./AlertService";
import { reportsStore } from "@/stores/reports";

export default class ReportService {
  //
  public static async refresh(): Promise<any> {
    try {
      const reponse = await axios.get(`${import.meta.env.VITE_APP_BASEPATH_SERVER}/reports/`, {
        headers: UserService.getAuthHeader(),
      });
      const newGroupsCached = { date: new Date(), data: reponse.data };
      const reports = reportsStore();
      reports.$patch({
        groups: newGroupsCached.data.groups,
      });
    } catch (err: any) {
      AlertService.send({ text: `ERR: Error getting reports: ${err.message}`, type: "error" });
    }
  }

  public static async deleteVersion(group: string, project: string, version: string): Promise<void> {
    axios
      .delete(`${import.meta.env.VITE_APP_BASEPATH_SERVER}/reports/${group}/${project}/${version}/`, {
        headers: UserService.getAuthHeader(),
      })
      .catch((err) => {
        AlertService.send({ text: `ERR: Error getting reports: ${err.message}`, type: "error" });
      });
  }
}
