import { AuthService } from "~~/services/AuthService";
import Config from "~~/services/Config";
import { handleError, EventBus, EventTypes } from "~~/services/EventBus";
import axios from "axios";
import * as _ from "lodash";

export const ReportsStore = defineStore("ReportsStore", {
  state: () => ({
    isFetching: false,
    groups: [],
  }),

  getters: {},

  actions: {
    async fetch(): Promise<void> {
      if (this.isFetching) {
        return;
      }
      this.isFetching = true;
      await axios
        .get(`${(await Config.get()).SERVER_URL}/reports`, await AuthService.getAuthHeader())
        .then((res: any) => {
          console.log(res)
          this.groups = res.data.groups;
        })
        .catch(handleError);
        setTimeout(() => {
          this.isFetching = false;
          this.fetch()
        },5000)
      },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(ReportsStore, import.meta.hot));
}
