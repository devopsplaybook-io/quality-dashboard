import { defineStore } from "pinia";

export const userAuthenticationStore = defineStore("userAuthentication", {
  state: () => {
    return {
      isAuthenticated: false,
      authToken: "",
    };
  },
});
