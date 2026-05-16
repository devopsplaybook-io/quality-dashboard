import { AuthService } from "~~/services/AuthService";
import Config from "~~/services/Config";
import { handleError } from "~~/services/EventBus";
import axios from "axios";

export interface Metric {
  name: string;
  type: "count" | "percentage" | "duration" | "boolean";
  value: number;
}

export interface ReportTag {
  tag: string;
  value: string;
}

/** A logical Report (one row per unique key). */
export interface Report {
  key: string;
  displayName: string | null;
  dateCreated: string;
  tags: ReportTag[];
}

/** One upload of a Report. */
export interface ReportVersion {
  id: string;
  reportKey: string;
  reportDisplayName: string | null;
  processor: string;
  metrics: Metric[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  info?: any;
  hasFile: boolean;
  fileEntrypoint?: string;
  dateCreated: string;
  tags: ReportTag[];
}

export const ReportsStore = defineStore("ReportsStore", {
  state: () => ({
    reports: [] as Report[],
    recentVersions: [] as ReportVersion[],
    isFetching: false,
    isFetchingRecent: false,
    lastError: null as string | null,
    lastFetched: 0 as number,
    lastFetchedRecent: 0 as number,
  }),

  getters: {
    reportsByKey: (state): Map<string, Report> => {
      const m = new Map<string, Report>();
      for (const r of state.reports) {
        m.set(r.key, r);
      }
      return m;
    },
  },

  actions: {
    async fetchReports(): Promise<void> {
      if (this.isFetching) return;
      this.isFetching = true;
      try {
        const res = await axios.get(
          `${(await Config.get()).SERVER_URL}/reports`,
          await AuthService.getAuthHeader(),
        );
        this.reports = (res.data.reports || []) as Report[];
        this.lastError = null;
        this.lastFetched = Date.now();
      } catch (err) {
        this.lastError = (err as Error).message;
        handleError(err);
      } finally {
        this.isFetching = false;
      }
    },

    async fetchRecent(limit = 100): Promise<void> {
      if (this.isFetchingRecent) return;
      this.isFetchingRecent = true;
      try {
        const res = await axios.get(
          `${(await Config.get()).SERVER_URL}/reports/recent?limit=${limit}`,
          await AuthService.getAuthHeader(),
        );
        this.recentVersions = (res.data.versions || []) as ReportVersion[];
        this.lastError = null;
        this.lastFetchedRecent = Date.now();
      } catch (err) {
        this.lastError = (err as Error).message;
        handleError(err);
      } finally {
        this.isFetchingRecent = false;
      }
    },

    async fetchVersionsForReport(key: string): Promise<ReportVersion[]> {
      const res = await axios.get(
        `${(await Config.get()).SERVER_URL}/reports/${encodeURIComponent(key)}/versions`,
        await AuthService.getAuthHeader(),
      );
      return (res.data.versions || []) as ReportVersion[];
    },

    async fetchReport(key: string): Promise<Report | null> {
      try {
        const res = await axios.get(
          `${(await Config.get()).SERVER_URL}/reports/${encodeURIComponent(key)}`,
          await AuthService.getAuthHeader(),
        );
        return res.data.report as Report;
      } catch {
        return null;
      }
    },

    async setDisplayName(
      key: string,
      displayName: string | null,
    ): Promise<void> {
      await axios.put(
        `${(await Config.get()).SERVER_URL}/reports/${encodeURIComponent(key)}`,
        { displayName },
        await AuthService.getAuthHeader(),
      );
      const r = this.reports.find((x) => x.key === key);
      if (r) r.displayName = displayName;
    },

    async removeReport(key: string): Promise<void> {
      await axios.delete(
        `${(await Config.get()).SERVER_URL}/reports/${encodeURIComponent(key)}`,
        await AuthService.getAuthHeader(),
      );
      this.reports = this.reports.filter((r) => r.key !== key);
      this.recentVersions = this.recentVersions.filter(
        (v) => v.reportKey !== key,
      );
    },

    async removeVersion(key: string, versionId: string): Promise<void> {
      await axios.delete(
        `${(await Config.get()).SERVER_URL}/reports/${encodeURIComponent(key)}/versions/${versionId}`,
        await AuthService.getAuthHeader(),
      );
      this.recentVersions = this.recentVersions.filter(
        (v) => v.id !== versionId,
      );
    },
  },
});

if (import.meta.hot) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  import.meta.hot.accept(acceptHMRUpdate(ReportsStore as any, import.meta.hot));
}
