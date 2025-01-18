import { createRouter, createWebHistory } from "vue-router";
import SettingsPage from "@/views/SettingsPage.vue";
import ReportsPage from "@/views/ReportsPage.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "reports",
      component: ReportsPage,
    },
    {
      path: "/settings",
      name: "settings",
      component: SettingsPage,
    },
  ],
});

export default router;
