import axios from "axios";
import { Config } from "./Config";
import { TestHelpers } from "./TestHelpers";

describe("/api/dashboards/", () => {
  //
  let authToken: string;

  beforeEach(async () => {
    authToken = await TestHelpers.resetAll();
    await TestHelpers.setSettings(authToken, { isDashboardPublic: true });
  });

  test("Empty list initially", async () => {
    const r = await axios.get(`${Config.APIURL}/dashboards`);
    expect(r.data.dashboards).toEqual([]);
  });

  test("POST /dashboards creates a dashboard", async () => {
    const r = await axios.post(
      `${Config.APIURL}/dashboards`,
      {
        name: "My Dashboard",
        levels: [{ tag: "team" }, { tag: "env", value: "prod" }],
      },
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
    expect(r.status).toEqual(201);
    expect(r.data.dashboard.id).toBeDefined();
    expect(r.data.dashboard.name).toEqual("My Dashboard");
    expect(r.data.dashboard.levels).toEqual([
      { tag: "team", value: undefined },
      { tag: "env", value: "prod" },
    ]);

    const list = await axios.get(`${Config.APIURL}/dashboards`);
    expect(list.data.dashboards).toHaveLength(1);
  });

  test("POST /dashboards rejects empty name", async () => {
    const response = await axios
      .post(
        `${Config.APIURL}/dashboards`,
        { name: "", levels: [] },
        { headers: { Authorization: `Bearer ${authToken}` } },
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .catch((err: any) => err.response);
    expect(response.status).toEqual(400);
  });

  test("PUT /dashboards/:id updates a dashboard", async () => {
    const created = await axios.post(
      `${Config.APIURL}/dashboards`,
      { name: "Old", levels: [{ tag: "team" }] },
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
    const id = created.data.dashboard.id;

    await axios.put(
      `${Config.APIURL}/dashboards/${id}`,
      { name: "New", levels: [{ tag: "env", value: "prod" }] },
      { headers: { Authorization: `Bearer ${authToken}` } },
    );

    const r = await axios.get(`${Config.APIURL}/dashboards/${id}`);
    expect(r.data.dashboard.name).toEqual("New");
    expect(r.data.dashboard.levels).toEqual([{ tag: "env", value: "prod" }]);
  });

  test("DELETE /dashboards/:id removes a dashboard", async () => {
    const created = await axios.post(
      `${Config.APIURL}/dashboards`,
      { name: "X", levels: [] },
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
    const id = created.data.dashboard.id;
    await axios.delete(`${Config.APIURL}/dashboards/${id}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const list = await axios.get(`${Config.APIURL}/dashboards`);
    expect(list.data.dashboards).toEqual([]);
  });

  test("GET /:id 404 for unknown id", async () => {
    const response = await axios
      .get(`${Config.APIURL}/dashboards/does-not-exist`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .catch((err: any) => err.response);
    expect(response.status).toEqual(404);
  });

  test("Anonymous cannot create a dashboard", async () => {
    const response = await axios
      .post(`${Config.APIURL}/dashboards`, {
        name: "Hack",
        levels: [],
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .catch((err: any) => err.response);
    expect(response.status).toEqual(403);
  });

  describe("aggregate", () => {
    //
    beforeEach(async () => {
      // Two reports in team=platform, one in team=app
      await TestHelpers.sendReport({
        meta: {
          key: "report-a",
          processor: "json",
          jsonPayload: {
            metrics: [
              { name: "cases", type: "count", value: 10 },
              { name: "pass-rate", type: "percentage", value: 80 },
            ],
          },
        },
        authToken,
      });
      await TestHelpers.sendReport({
        meta: {
          key: "report-b",
          processor: "json",
          jsonPayload: {
            metrics: [
              { name: "cases", type: "count", value: 4 },
              { name: "pass-rate", type: "percentage", value: 60 },
            ],
          },
        },
        authToken,
      });
      await TestHelpers.sendReport({
        meta: {
          key: "report-c",
          processor: "json",
          jsonPayload: {
            metrics: [{ name: "cases", type: "count", value: 1 }],
          },
        },
        authToken,
      });
      // Tag them
      await axios.put(
        `${Config.APIURL}/tags/reports/report-a`,
        {
          tags: [
            { tag: "team", value: "platform" },
            { tag: "env", value: "prod" },
          ],
        },
        { headers: { Authorization: `Bearer ${authToken}` } },
      );
      await axios.put(
        `${Config.APIURL}/tags/reports/report-b`,
        {
          tags: [
            { tag: "team", value: "platform" },
            { tag: "env", value: "staging" },
          ],
        },
        { headers: { Authorization: `Bearer ${authToken}` } },
      );
      await axios.put(
        `${Config.APIURL}/tags/reports/report-c`,
        {
          tags: [
            { tag: "team", value: "app" },
            { tag: "env", value: "prod" },
          ],
        },
        { headers: { Authorization: `Bearer ${authToken}` } },
      );
    });

    test("Single level (tag only) groups by all values", async () => {
      const created = await axios.post(
        `${Config.APIURL}/dashboards`,
        { name: "By team", levels: [{ tag: "team" }] },
        { headers: { Authorization: `Bearer ${authToken}` } },
      );
      const id = created.data.dashboard.id;
      const r = await axios.get(`${Config.APIURL}/dashboards/${id}/aggregate`);
      // Two groups: team=app and team=platform
      expect(r.data.tree).toHaveLength(2);
      const byLabel = new Map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        r.data.tree.map((n: any) => [n.label, n]),
      );
      expect(byLabel.has("team=app")).toBe(true);
      expect(byLabel.has("team=platform")).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const platform = byLabel.get("team=platform") as any;
      expect(platform.reportKeys).toEqual(
        expect.arrayContaining(["report-a", "report-b"]),
      );
      // counts summed: 10 + 4 = 14
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cases = platform.metrics.find((m: any) => m.name === "cases");
      expect(cases.value).toEqual(14);
      // percentages averaged: (80 + 60) / 2 = 70
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pr = platform.metrics.find((m: any) => m.name === "pass-rate");
      expect(pr.value).toEqual(70);
    });

    test("Single level (tag=value) filters and yields one group", async () => {
      const created = await axios.post(
        `${Config.APIURL}/dashboards`,
        {
          name: "Prod",
          levels: [{ tag: "env", value: "prod" }],
        },
        { headers: { Authorization: `Bearer ${authToken}` } },
      );
      const id = created.data.dashboard.id;
      const r = await axios.get(`${Config.APIURL}/dashboards/${id}/aggregate`);
      expect(r.data.tree).toHaveLength(1);
      expect(r.data.tree[0].label).toEqual("env=prod");
      expect(r.data.tree[0].reportKeys).toEqual(
        expect.arrayContaining(["report-a", "report-c"]),
      );
      expect(r.data.tree[0].reportKeys).not.toEqual(
        expect.arrayContaining(["report-b"]),
      );
    });

    test("Multi-level: team -> env produces nested groups", async () => {
      const created = await axios.post(
        `${Config.APIURL}/dashboards`,
        {
          name: "Team / Env",
          levels: [{ tag: "team" }, { tag: "env" }],
        },
        { headers: { Authorization: `Bearer ${authToken}` } },
      );
      const id = created.data.dashboard.id;
      const r = await axios.get(`${Config.APIURL}/dashboards/${id}/aggregate`);
      const byLabel = new Map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        r.data.tree.map((n: any) => [n.label, n]),
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const platform = byLabel.get("team=platform") as any;
      expect(platform.children).toHaveLength(2);
      const childLabels = platform.children
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((c: any) => c.label)
        .sort();
      expect(childLabels).toEqual(["env=prod", "env=staging"]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app = byLabel.get("team=app") as any;
      expect(app.children).toHaveLength(1);
      expect(app.children[0].label).toEqual("env=prod");
    });

    test("Aggregate uses latest version of each report", async () => {
      // Upload a new version of report-a with different metrics
      await new Promise((r) => setTimeout(r, 1100));
      await TestHelpers.sendReport({
        meta: {
          key: "report-a",
          processor: "json",
          jsonPayload: {
            metrics: [{ name: "cases", type: "count", value: 99 }],
          },
        },
        authToken,
      });

      const created = await axios.post(
        `${Config.APIURL}/dashboards`,
        { name: "By team", levels: [{ tag: "team", value: "platform" }] },
        { headers: { Authorization: `Bearer ${authToken}` } },
      );
      const id = created.data.dashboard.id;
      const r = await axios.get(`${Config.APIURL}/dashboards/${id}/aggregate`);
      expect(r.data.tree).toHaveLength(1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cases = r.data.tree[0].metrics.find((m: any) => m.name === "cases");
      // Latest report-a (99) + report-b (4) = 103
      expect(cases.value).toEqual(103);
    });
  });
});
