import { AuthService } from "~~/services/AuthService";

export const AuthenticationStore = defineStore("AuthenticationStore", {
  state: () => ({
    isAuthenticated: false,
    userId: null as string | null,
    userName: null as string | null,
    role: null as string | null,
    permissions: {
      canConfigureDashboards: false,
      canConfigureReportTags: false,
    },
  }),

  getters: {
    isAdmin(): boolean {
      return this.role === "admin";
    },
    canConfigureDashboards(): boolean {
      return this.isAdmin || this.permissions.canConfigureDashboards;
    },
    canConfigureReportTags(): boolean {
      return this.isAdmin || this.permissions.canConfigureReportTags;
    },
  },

  actions: {
    async ensureAuthenticated(): Promise<boolean> {
      this.isAuthenticated = await AuthService.isAuthenticated();
      if (this.isAuthenticated) {
        const info = await AuthService.getTokenInfo();
        if (info) {
          this.userId = info.userId;
          this.userName = info.userName;
          this.role = info.role;
          this.permissions = info.permissions || {
            canConfigureDashboards: false,
            canConfigureReportTags: false,
          };
        }
      } else {
        this.userId = null;
        this.userName = null;
        this.role = null;
        this.permissions = {
          canConfigureDashboards: false,
          canConfigureReportTags: false,
        };
      }
      return this.isAuthenticated;
    },

    async refreshFromToken(): Promise<void> {
      const info = await AuthService.getTokenInfo();
      if (info) {
        this.userId = info.userId;
        this.userName = info.userName;
        this.role = info.role;
        this.permissions = info.permissions || {
          canConfigureDashboards: false,
          canConfigureReportTags: false,
        };
        this.isAuthenticated = true;
      }
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(AuthenticationStore, import.meta.hot));
}
