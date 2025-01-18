import { defineStore } from "pinia";

export const reportsStore = defineStore("reports", {
  state: () => {
    return {
      groups: [],
    };
  },
});
