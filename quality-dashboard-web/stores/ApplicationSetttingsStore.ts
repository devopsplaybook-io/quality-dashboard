import { Timeout } from "~~/services/Timeout";
import { AuthService } from "~~/services/AuthService";
import Config from "~~/services/Config";
import { handleError, EventBus, EventTypes } from "~~/services/EventBus";
import axios from "axios";
import * as _ from "lodash";

export const ApplicationSetttingsStore = defineStore("ApplicationSetttingsStore", {
  state: () => ({
    isInitialized: true,
    isDashboardPublic: false,
  }),

  getters: {},

  actions: {
    async refresh(): Promise<void> {
      await axios
        .get(`${(await Config.get()).SERVER_URL}/settings`, await AuthService.getAuthHeader())
        .then((res) => {
          this.isInitialized = res.data.isInitialized;
          this.isDashboardPublic = res.data.isDashboardPublic;
        })
        .catch(handleError);
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(ApplicationSetttingsStore, import.meta.hot));
}
