import { AuthService } from "~~/services/AuthService";
import Config from "~~/services/Config";
import { handleError } from "~~/services/EventBus";
import axios from "axios";
import type { Metric } from "./ReportsStore";

export interface DashboardLevel {
  tag: string;
  value?: string;
}

export interface Dashboard {
  id: string;
  name: string;
  levels: DashboardLevel[];
  dateCreated: string;
  dateModified: string;
}

export interface AggregatedNode {
  label: string;
  level: number;
  reportKeys: string[];
  metrics: Metric[];
  children: AggregatedNode[];
}

export interface DashboardAggregate {
  dashboard: Dashboard;
  tree: AggregatedNode[];
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

    async fetchAggregate(id: string): Promise<DashboardAggregate | null> {
      try {
        const res = await axios.get(
          `${(await Config.get()).SERVER_URL}/dashboards/${id}/aggregate`,
          await AuthService.getAuthHeader(),
        );
        this.lastError = null;
        return {
          dashboard: res.data.dashboard,
          tree: res.data.tree,
        };
      } catch (err) {
        this.lastError = (err as Error).message;
        handleError(err);
        return null;
      }
    },

    async create(name: string, levels: DashboardLevel[]): Promise<Dashboard> {
      const res = await axios.post(
        `${(await Config.get()).SERVER_URL}/dashboards`,
        { name, levels },
        await AuthService.getAuthHeader(),
      );
      const created = res.data.dashboard as Dashboard;
      this.dashboards.push(created);
      return created;
    },

    async update(
      id: string,
      name: string,
      levels: DashboardLevel[],
    ): Promise<void> {
      await axios.put(
        `${(await Config.get()).SERVER_URL}/dashboards/${id}`,
        { name, levels },
        await AuthService.getAuthHeader(),
      );
      const d = this.dashboards.find((x) => x.id === id);
      if (d) {
        d.name = name;
        d.levels = levels;
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
