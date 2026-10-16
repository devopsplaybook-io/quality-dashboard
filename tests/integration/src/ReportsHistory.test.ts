import axios from "axios";
import { Config } from "./Config";
import { TestHelpers } from "./TestHelpers";

describe("/api/reports/history", () => {
  //
  let authToken: string;

  beforeEach(async () => {
    authToken = await TestHelpers.resetAll();
    await TestHelpers.setSettings(authToken, { isDashboardPublic: true });
  });

  async function upload(key: string, value: number): Promise<void> {
    await TestHelpers.sendReport({
      meta: {
        key,
        processor: "json",
        jsonPayload: {
          metrics: [
            { name: "n", type: "count", value },
            { name: "tests.failed", type: "count", value: value * 10 },
          ],
        },
      },
      authToken,
    });
  }

  test("Returns 200 with a versions array when empty", async () => {
    const response = await axios.get(`${Config.APIURL}/reports/history`);
    expect(response.status).toEqual(200);
    expect(response.data).toHaveProperty("versions");
    expect(Array.isArray(response.data.versions)).toBeTruthy();
    expect(response.data.versions).toHaveLength(0);
  });

  test("Returns bounded history per report, latest first, lean fields", async () => {
    // Upload with waits so date_created ordering is unambiguous
    await upload("report-a", 1);
    await new Promise((r) => setTimeout(r, 1100));
    await upload("report-b", 100);
    await new Promise((r) => setTimeout(r, 1100));
    await upload("report-a", 2);
    await new Promise((r) => setTimeout(r, 1100));
    await upload("report-b", 200);
    await new Promise((r) => setTimeout(r, 1100));
    await upload("report-a", 3);

    const response = await axios.get(`${Config.APIURL}/reports/history`);
    expect(response.status).toEqual(200);
    const versions = response.data.versions;
    expect(versions).toHaveLength(5);

    // All entries belong to report-a or report-b and carry lean fields only
    for (const v of versions) {
      expect(["report-a", "report-b"]).toContain(v.reportKey);
      expect(v.metrics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "n" }),
          expect.objectContaining({ name: "tests.failed" }),
        ]),
      );
      expect(v.id).toBeTruthy();
      expect(v.dateCreated).toBeTruthy();
      expect(v).not.toHaveProperty("processor");
      expect(v).not.toHaveProperty("hasFile");
      expect(v).not.toHaveProperty("fileEntrypoint");
      expect(v).not.toHaveProperty("info");
      expect(v).not.toHaveProperty("tags");
    }

    // Per report, ordered latest first
    const a = versions.filter(
      (v: { reportKey: string }) => v.reportKey === "report-a",
    );
    const b = versions.filter(
      (v: { reportKey: string }) => v.reportKey === "report-b",
    );
    expect(a).toHaveLength(3);
    expect(b).toHaveLength(2);
    expect(a.map((v: { metrics: { name: string; value: number }[] }) =>
      v.metrics.find((m) => m.name === "n").value,
    )).toEqual([3, 2, 1]);
    expect(b.map((v: { metrics: { name: string; value: number }[] }) =>
      v.metrics.find((m) => m.name === "n").value,
    )).toEqual([200, 100]);
  });

  test("limit caps the number of versions per report", async () => {
    await upload("capped", 1);
    await new Promise((r) => setTimeout(r, 1100));
    await upload("capped", 2);
    await new Promise((r) => setTimeout(r, 1100));
    await upload("capped", 3);

    const response = await axios.get(
      `${Config.APIURL}/reports/history?limit=2`,
    );
    expect(response.status).toEqual(200);
    expect(response.data.versions).toHaveLength(2);
    expect(response.data.versions.map(
      (v: { metrics: { name: string; value: number }[] }) =>
        v.metrics.find((m: { name: string }) => m.name === "n").value,
    )).toEqual([3, 2]);
  });

  test("Bogus limit falls back to the default without erroring", async () => {
    await upload("bogus", 1);

    for (const limit of ["abc", "-1", "0"]) {
      const response = await axios.get(
        `${Config.APIURL}/reports/history?limit=${limit}`,
      );
      expect(response.status).toEqual(200);
      expect(response.data.versions).toHaveLength(1);
    }
  });

  test("Returns 403 when the dashboard is not public and no auth is provided", async () => {
    await TestHelpers.setSettings(authToken, { isDashboardPublic: false });
    const response = await axios
      .get(`${Config.APIURL}/reports/history`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .catch((err: any) => err.response);
    expect(response.status).toEqual(403);
  });
});
