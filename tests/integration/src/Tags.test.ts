import axios from "axios";
import { Config } from "./Config";
import { TestHelpers } from "./TestHelpers";

describe("/api/tags/", () => {
  //
  let authToken: string;

  beforeEach(async () => {
    authToken = await TestHelpers.resetAll();
    await TestHelpers.setSettings(authToken, { isDashboardPublic: true });
    await TestHelpers.sendReport({
      meta: {
        key: "report-a",
        processor: "json",
        jsonPayload: { metrics: [] },
      },
      authToken,
    });
    await TestHelpers.sendReport({
      meta: {
        key: "report-b",
        processor: "json",
        jsonPayload: { metrics: [] },
      },
      authToken,
    });
  });

  test("PUT /tags/reports/:key sets all tags", async () => {
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
    const r = await axios.get(`${Config.APIURL}/reports/report-a`);
    expect(r.data.report.tags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tag: "team", value: "platform" }),
        expect.objectContaining({ tag: "env", value: "prod" }),
      ]),
    );
  });

  test("PUT /tags/reports/:key/:tag sets a single tag", async () => {
    await axios.put(
      `${Config.APIURL}/tags/reports/report-a/team`,
      { value: "platform" },
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
    const r = await axios.get(`${Config.APIURL}/reports/report-a`);
    expect(r.data.report.tags).toEqual([
      expect.objectContaining({ tag: "team", value: "platform" }),
    ]);
  });

  test("DELETE /tags/reports/:key/:tag removes a tag", async () => {
    await axios.put(
      `${Config.APIURL}/tags/reports/report-a/team`,
      { value: "platform" },
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
    await axios.delete(`${Config.APIURL}/tags/reports/report-a/team`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const r = await axios.get(`${Config.APIURL}/reports/report-a`);
    expect(r.data.report.tags).toHaveLength(0);
  });

  test("Tags persist across new versions", async () => {
    await axios.put(
      `${Config.APIURL}/tags/reports/report-a/env`,
      { value: "prod" },
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
    // Send a new version of report-a
    const v2 = await TestHelpers.sendReport({
      meta: {
        key: "report-a",
        processor: "json",
        jsonPayload: { metrics: [] },
      },
      authToken,
    });
    expect(v2.data.report.tags).toEqual([
      expect.objectContaining({ tag: "env", value: "prod" }),
    ]);
  });

  test("GET /tags returns aggregate tag/value list", async () => {
    await axios.put(
      `${Config.APIURL}/tags/reports/report-a/env`,
      { value: "prod" },
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
    await axios.put(
      `${Config.APIURL}/tags/reports/report-b/env`,
      { value: "staging" },
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
    const all = await axios.get(`${Config.APIURL}/tags`);
    expect(all.data.tags).toEqual([
      expect.objectContaining({
        tag: "env",
        values: expect.arrayContaining(["prod", "staging"]),
      }),
    ]);
  });

  test("Anonymous cannot modify tags", async () => {
    const response = await axios
      .put(`${Config.APIURL}/tags/reports/report-a/team`, { value: "x" })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .catch((err: any) => err.response);
    expect(response.status).toEqual(403);
  });
});
