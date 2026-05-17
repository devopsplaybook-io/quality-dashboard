import { AuthService } from "~~/services/AuthService";
import Config from "~~/services/Config";
import { handleError } from "~~/services/EventBus";
import axios from "axios";
import type { Metric } from "./ReportsStore";

/** One node of a dashboard's level tree (server-aligned shape). */
export interface DashboardLevelNode {
  id: string;
  tag: string;
  value?: string;
  children: DashboardLevelNode[];
}

export interface Dashboard {
  id: string;
  name: string;
  schemaVersion: number;
  root: DashboardLevelNode[];
  dateCreated: string;
  dateModified: string;
}

/** A report row as returned by /dashboards/:id/data. */
export interface DashboardReport {
  key: string;
  tags: { tag: string; value: string }[];
  metrics: Metric[];
  dateCreated: string;
}

export interface DashboardData {
  dashboard: Dashboard;
  reports: DashboardReport[];
}

export const DashboardsStore = defineStore("DashboardsStore", {
  state: () => ({
    dashboards: [] as Dashboard[],
    isFetching: false,
    lastError: null as string | null,
  }),

  actions: {
    async fetchAll(): Promise<void> {
      if (this.isFetching) return;
      this.isFetching = true;
      try {
        const res = await axios.get(
          `${(await Config.get()).SERVER_URL}/dashboards`,
          await AuthService.getAuthHeader(),
        );
        this.dashboards = (res.data.dashboards || []) as Dashboard[];
        this.lastError = null;
      } catch (err) {
        this.lastError = (err as Error).message;
        handleError(err);
      } finally {
        this.isFetching = false;
      }
    },

    async fetchOne(id: string): Promise<Dashboard | null> {
      try {
        const res = await axios.get(
          `${(await Config.get()).SERVER_URL}/dashboards/${id}`,
          await AuthService.getAuthHeader(),
        );
        return res.data.dashboard as Dashboard;
      } catch {
        return null;
      }
    },

    async fetchDashboardData(id: string): Promise<DashboardData | null> {
      try {
        const res = await axios.get(
          `${(await Config.get()).SERVER_URL}/dashboards/${id}/data`,
          await AuthService.getAuthHeader(),
        );
        this.lastError = null;
        return {
          dashboard: res.data.dashboard as Dashboard,
          reports: (res.data.reports || []) as DashboardReport[],
        };
      } catch (err) {
        this.lastError = (err as Error).message;
        handleError(err);
        return null;
      }
    },

    async create(name: string, root: DashboardLevelNode[]): Promise<Dashboard> {
      const res = await axios.post(
        `${(await Config.get()).SERVER_URL}/dashboards`,
        { name, root },
        await AuthService.getAuthHeader(),
      );
      const created = res.data.dashboard as Dashboard;
      this.dashboards.push(created);
      return created;
    },

    async update(
      id: string,
      name: string,
      root: DashboardLevelNode[],
    ): Promise<void> {
      const res = await axios.put(
        `${(await Config.get()).SERVER_URL}/dashboards/${id}`,
        { name, root },
        await AuthService.getAuthHeader(),
      );
      void res;
      const d = this.dashboards.find((x) => x.id === id);
      if (d) {
        d.name = name;
        d.root = root;
      }
    },

    async remove(id: string): Promise<void> {
      await axios.delete(
        `${(await Config.get()).SERVER_URL}/dashboards/${id}`,
        await AuthService.getAuthHeader(),
      );
      this.dashboards = this.dashboards.filter((d) => d.id !== id);
    },
  },
});

if (import.meta.hot) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  import.meta.hot.accept(
    acceptHMRUpdate(DashboardsStore as any, import.meta.hot),
  );
}
