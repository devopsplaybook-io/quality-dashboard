import axios from "axios";
import * as fs from "fs";
import FormData from "form-data";
import { Config } from "./Config";

export interface SendReportOptions {
  url?: string;
  meta: {
    /** Stable unique key of the Report. */
    key: string;
    /** Optional human display name. */
    displayName?: string;
    processor: string;
    jsonPayload?: unknown;
  };
  filePath?: string;
  fileBuffer?: Buffer;
  fileName?: string;
  authToken?: string;
  uploadToken?: string;
}

export interface SendReportResult {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

export const TestHelpers = {
  //
  async resetAll(): Promise<string> {
    // Login as the admin left by a previous reset (admin/admin),
    // or initialize a fresh server with it.
    let authToken: string;
    let adminId: string;
    try {
      const responseLogin = await axios.post(`${Config.APIURL}/users/session`, {
        name: "admin",
        password: "admin",
      });
      authToken = responseLogin.data.token;
      adminId = responseLogin.data.user.id;
    } catch {
      const init = await axios.post(`${Config.APIURL}/users/`, {
        name: "admin",
        password: "admin",
      });
      authToken = (await axios.post(`${Config.APIURL}/users/session`, {
        name: "admin",
        password: "admin",
      })).data.token;
      adminId = init.data.user.id;
    }
    const headers = { Authorization: `Bearer ${authToken}` };

    // Remove all users except the logged-in admin
    const users = await axios.get(`${Config.APIURL}/users/`, { headers });
    for (const user of users.data as { id: string }[]) {
      if (user.id !== adminId) {
        await axios.delete(`${Config.APIURL}/users/${user.id}`, { headers });
      }
    }

    // Reset reports (requires auth)
    await axios.delete(`${Config.APIURL}/reports`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    // Reset dashboards (requires auth)
    try {
      const list = await axios.get(`${Config.APIURL}/dashboards`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const d of list.data.dashboards as any[]) {
        await axios.delete(`${Config.APIURL}/dashboards/${d.id}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
      }
    } catch {
      // ignore if dashboards endpoint not present
    }

    return authToken;
  },

  async setSettings(
    authToken: string,
    settings: { isDashboardPublic?: boolean; uploadToken?: string; webhookUrl?: string },
  ): Promise<void> {
    await axios.put(
      `${Config.APIURL}/settings/`,
      {
        isDashboardPublic: settings.isDashboardPublic ?? true,
        uploadToken: settings.uploadToken ?? "",
        webhookUrl: settings.webhookUrl ?? "",
      },
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
  },

  async setGates(
    authToken: string,
    key: string,
    gates: {
      metric: string;
      operator: string;
      warnValue?: number | null;
      failValue: number;
    }[],
  ): Promise<{ status: number; data: { gates?: { id: string; metric: string; operator: string; warnValue: number | null; failValue: number }[] } }> {
    const headers = { Authorization: `Bearer ${authToken}` };
    try {
      const response = await axios.put(
        `${Config.APIURL}/reports/${encodeURIComponent(key)}/gates`,
        { gates },
        { headers },
      );
      return { status: response.status, data: response.data };
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      if (e.response) {
        return { status: e.response.status, data: e.response.data };
      }
      throw err;
    }
  },

  async sendReport(opts: SendReportOptions): Promise<SendReportResult> {
    const url = opts.url || `${Config.APIURL}/reports/`;
    const form = new FormData();
    form.append("meta", JSON.stringify(opts.meta));
    if (opts.filePath) {
      form.append("file", fs.createReadStream(opts.filePath), {
        filename: opts.fileName || opts.filePath.split("/").pop(),
      });
    } else if (opts.fileBuffer) {
      form.append("file", opts.fileBuffer, {
        filename: opts.fileName || "report.bin",
      });
    }
    const headers: Record<string, string> = {
      ...(form.getHeaders() as Record<string, string>),
    };
    if (opts.authToken) {
      headers.Authorization = `Bearer ${opts.authToken}`;
    }
    if (opts.uploadToken) {
      headers["X-Upload-Token"] = opts.uploadToken;
    }
    try {
      const response = await axios.post(url, form, {
        headers,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
      return { status: response.status, data: response.data };
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      if (e.response) {
        return { status: e.response.status, data: e.response.data };
      }
      throw err;
    }
  },
};
