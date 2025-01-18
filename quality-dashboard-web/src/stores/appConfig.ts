import { defineStore } from "pinia";

export const appConfigStore = defineStore("appConfig", {
  state: () => {
    return {
      isAuthInitialized: true,
      isDashboardPublic: false,
      uploadToken: "",
    };
  },
});
