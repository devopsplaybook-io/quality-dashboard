import axios from "axios";
import { Config } from "./Config";
import { TestHelpers } from "./TestHelpers";

describe("/api/reports/", () => {
  //
  let authToken: string;

  beforeEach(async () => {
    authToken = await TestHelpers.resetAll();
    await TestHelpers.setSettings(authToken, { isDashboardPublic: true });
  });

  describe("GET /api/reports/processors", () => {
    test("Lists available processors", async () => {
      const response = await axios.get(`${Config.APIURL}/reports/processors`);
      expect(response.status).toEqual(200);
      expect(response.data).toHaveProperty("processors");
      expect(Array.isArray(response.data.processors)).toBeTruthy();
      const names = response.data.processors.map(
        (p: { name: string }) => p.name,
      );
      expect(names).toContain("json");
    });
  });

  describe("GET /api/reports/", () => {
    test("Lists empty initially", async () => {
      const response = await axios.get(`${Config.APIURL}/reports`);
      expect(response.status).toEqual(200);
      expect(response.data).toHaveProperty("reports");
      expect(Array.isArray(response.data.reports)).toBeTruthy();
      expect(response.data.reports).toHaveLength(0);
    });
  });

  describe("POST /api/reports/", () => {
    test("Send a JSON report (no file) creates Report + Version", async () => {
      const response = await TestHelpers.sendReport({
        meta: {
          key: "unit-tests",
          displayName: "Unit Tests",
          processor: "json",
          jsonPayload: {
            metrics: [
              { name: "tests.passed", type: "count", value: 42 },
              { name: "tests.coverage", type: "percentage", value: 87.3 },
            ],
          },
        },
        authToken,
      });
      expect(response.status).toEqual(201);
      expect(response.data.report.key).toEqual("unit-tests");
      expect(response.data.report.displayName).toEqual("Unit Tests");
      expect(response.data.version).toHaveProperty("id");
      expect(response.data.version.processor).toEqual("json");
      expect(response.data.version.metrics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "tests.passed",
            type: "count",
            value: 42,
          }),
          expect.objectContaining({
            name: "tests.coverage",
            type: "percentage",
            value: 87.3,
          }),
        ]),
      );
      expect(response.data.version.hasFile).toBeFalsy();
    });

    test("Same key creates a new version (keeps old)", async () => {
      await TestHelpers.sendReport({
        meta: {
          key: "same-key",
          processor: "json",
          jsonPayload: {
            metrics: [{ name: "n", type: "count", value: 1 }],
          },
        },
        authToken,
      });
      await TestHelpers.sendReport({
        meta: {
          key: "same-key",
          processor: "json",
          jsonPayload: {
            metrics: [{ name: "n", type: "count", value: 2 }],
          },
        },
        authToken,
      });
      const versions = await axios.get(
        `${Config.APIURL}/reports/same-key/versions`,
      );
      expect(versions.status).toEqual(200);
      expect(versions.data.versions).toHaveLength(2);
    });

    test("Send a jest-html-reporter HTML file", async () => {
      const response = await TestHelpers.sendReport({
        meta: {
          key: "unit-tests",
          processor: "jest-html-reporter",
        },
        filePath: `${__dirname}/../samples/test-report.html`,
        fileName: "test-report.html",
        authToken,
      });
      expect(response.status).toEqual(201);
      expect(response.data.version.hasFile).toBeTruthy();
      expect(response.data.version.fileEntrypoint).toEqual("test-report.html");
      const metricNames = response.data.version.metrics.map(
        (m: { name: string }) => m.name,
      );
      expect(metricNames).toEqual(expect.arrayContaining(["tests.total"]));
    });

    test("Listed report is returned by GET /", async () => {
      await TestHelpers.sendReport({
        meta: {
          key: "r1",
          displayName: "Report One",
          processor: "json",
          jsonPayload: { metrics: [{ name: "n", type: "count", value: 1 }] },
        },
        authToken,
      });
      const response = await axios.get(`${Config.APIURL}/reports`);
      expect(response.data.reports).toHaveLength(1);
      expect(response.data.reports[0].key).toEqual("r1");
      expect(response.data.reports[0].displayName).toEqual("Report One");
    });

    test("Reject missing 'meta' field", async () => {
      const response = await TestHelpers.sendReport({
        // @ts-expect-error: simulating missing meta
        meta: undefined,
        authToken,
      });
      expect(response.status).toEqual(400);
    });

    test("Reject unknown processor", async () => {
      const response = await TestHelpers.sendReport({
        meta: {
          key: "x",
          processor: "non-existent-processor",
          jsonPayload: { metrics: [] },
        },
        authToken,
      });
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
    });

    test("Reject missing key", async () => {
      const response = await TestHelpers.sendReport({
        // @ts-expect-error: missing key
        meta: { processor: "json" },
        authToken,
      });
      expect(response.status).toEqual(400);
    });
  });

  describe("GET /api/reports/recent", () => {
    test("Returns versions in reverse chronological order", async () => {
      await TestHelpers.sendReport({
        meta: {
          key: "first",
          processor: "json",
          jsonPayload: { metrics: [] },
        },
        authToken,
      });
      // Wait for clock to advance to ensure ordering
      await new Promise((r) => setTimeout(r, 1100));
      await TestHelpers.sendReport({
        meta: {
          key: "second",
          processor: "json",
          jsonPayload: { metrics: [] },
        },
        authToken,
      });
      const response = await axios.get(`${Config.APIURL}/reports/recent`);
      expect(response.status).toEqual(200);
      expect(response.data.versions).toHaveLength(2);
      expect(response.data.versions[0].reportKey).toEqual("second");
      expect(response.data.versions[1].reportKey).toEqual("first");
    });
  });

  describe("GET /api/reports/:key", () => {
    test("Returns the report", async () => {
      await TestHelpers.sendReport({
        meta: {
          key: "single",
          displayName: "Single",
          processor: "json",
          jsonPayload: { metrics: [{ name: "x", type: "count", value: 5 }] },
        },
        authToken,
      });
      const response = await axios.get(`${Config.APIURL}/reports/single`);
      expect(response.status).toEqual(200);
      expect(response.data.report.key).toEqual("single");
      expect(response.data.report.displayName).toEqual("Single");
    });

    test("Returns 404 for unknown key", async () => {
      const response = await axios
        .get(`${Config.APIURL}/reports/does-not-exist`)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .catch((err: any) => err.response);
      expect(response.status).toEqual(404);
    });
  });

  describe("GET /api/reports/:key/versions/:versionId/file/*", () => {
    test("Streams the version file", async () => {
      const created = await TestHelpers.sendReport({
        meta: {
          key: "with-file",
          processor: "jest-html-reporter",
        },
        filePath: `${__dirname}/../samples/test-report.html`,
        fileName: "test-report.html",
        authToken,
      });
      const versionId = created.data.version.id;
      const response = await axios.get(
        `${Config.APIURL}/reports/with-file/versions/${versionId}/file/test-report.html`,
        { responseType: "text" },
      );
      expect(response.status).toEqual(200);
      expect(String(response.headers["content-type"])).toContain("text/html");
      expect(typeof response.data).toEqual("string");
      expect(response.data.length).toBeGreaterThan(0);
    });

    test("Path traversal is rejected", async () => {
      const created = await TestHelpers.sendReport({
        meta: {
          key: "trav",
          processor: "jest-html-reporter",
        },
        filePath: `${__dirname}/../samples/test-report.html`,
        fileName: "test-report.html",
        authToken,
      });
      const versionId = created.data.version.id;
      const response = await axios
        .get(
          `${Config.APIURL}/reports/trav/versions/${versionId}/file/../../../etc/passwd`,
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .catch((err: any) => err.response);
      expect(response.status).toEqual(404);
    });
  });

  describe("DELETE", () => {
    test("DELETE /:key deletes the report and all its versions", async () => {
      await TestHelpers.sendReport({
        meta: {
          key: "to-delete",
          processor: "json",
          jsonPayload: { metrics: [] },
        },
        authToken,
      });
      await TestHelpers.sendReport({
        meta: {
          key: "to-delete",
          processor: "json",
          jsonPayload: { metrics: [] },
        },
        authToken,
      });
      const del = await axios.delete(`${Config.APIURL}/reports/to-delete`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(del.status).toEqual(200);
      const list = await axios.get(`${Config.APIURL}/reports`);
      expect(
        list.data.reports.find((r: { key: string }) => r.key === "to-delete"),
      ).toBeUndefined();
    });

    test("DELETE /:key/versions/:versionId deletes a single version", async () => {
      const r1 = await TestHelpers.sendReport({
        meta: {
          key: "many-versions",
          processor: "json",
          jsonPayload: { metrics: [] },
        },
        authToken,
      });
      await TestHelpers.sendReport({
        meta: {
          key: "many-versions",
          processor: "json",
          jsonPayload: { metrics: [] },
        },
        authToken,
      });
      const versionId = r1.data.version.id;
      const del = await axios.delete(
        `${Config.APIURL}/reports/many-versions/versions/${versionId}`,
        { headers: { Authorization: `Bearer ${authToken}` } },
      );
      expect(del.status).toEqual(200);
      const versions = await axios.get(
        `${Config.APIURL}/reports/many-versions/versions`,
      );
      expect(versions.data.versions).toHaveLength(1);
      expect(versions.data.versions[0].id).not.toEqual(versionId);
    });

    test("Anonymous cannot delete", async () => {
      await TestHelpers.sendReport({
        meta: {
          key: "to-delete",
          processor: "json",
          jsonPayload: { metrics: [] },
        },
        authToken,
      });
      const response = await axios
        .delete(`${Config.APIURL}/reports/to-delete`)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .catch((err: any) => err.response);
      expect(response.status).toEqual(403);
    });
  });
});
