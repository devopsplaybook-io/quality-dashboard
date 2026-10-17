import axios from "axios";
import * as http from "http";
import { Config } from "./Config";
import { TestHelpers } from "./TestHelpers";

function get(url: string): Promise<{ status: number; headers: any; data: any }> {
  return axios
    .get(url)
    .then((res) => ({ status: res.status, headers: res.headers, data: res.data }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .catch((err: any) => ({
      status: err.response.status,
      headers: err.response.headers,
      data: err.response.data,
    }));
}

describe("/api/reports/:key/gates", () => {
  //
  let authToken: string;

  beforeEach(async () => {
    authToken = await TestHelpers.resetAll();
    await TestHelpers.setSettings(authToken, { isDashboardPublic: true });
  });

  test("PUT validates rule shape", async () => {
    await TestHelpers.sendReport({
      meta: { key: "gates-validation", processor: "json", jsonPayload: { metrics: [] } },
      authToken,
    });
    const badOperator = await TestHelpers.setGates(authToken, "gates-validation", [
      { metric: "tests.failed", operator: "<", failValue: 0 },
    ]);
    expect(badOperator.status).toEqual(400);
    const emptyMetric = await TestHelpers.setGates(authToken, "gates-validation", [
      { metric: "", operator: "<=", failValue: 0 },
    ]);
    expect(emptyMetric.status).toEqual(400);
    const badFailValue = await TestHelpers.setGates(authToken, "gates-validation", [
      { metric: "tests.failed", operator: "<=", failValue: "zero" as unknown as number },
    ]);
    expect(badFailValue.status).toEqual(400);
  });

  test("PUT/GET require report to exist", async () => {
    const put = await TestHelpers.setGates(authToken, "does-not-exist", [
      { metric: "tests.failed", operator: "<=", failValue: 0 },
    ]);
    expect(put.status).toEqual(404);
    const got = await get(`${Config.APIURL}/reports/does-not-exist/gates`);
    expect(got.status).toEqual(404);
  });

  test("Gates endpoints require authentication for writes, allow reads", async () => {
    await TestHelpers.sendReport({
      meta: { key: "gates-auth", processor: "json", jsonPayload: { metrics: [] } },
      authToken,
    });
    const anonymousGet = await get(`${Config.APIURL}/reports/gates-auth/gates`);
    expect(anonymousGet.status).toEqual(200);
    const anonymousPut = await axios
      .put(`${Config.APIURL}/reports/gates-auth/gates`, { gates: [] })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .catch((err: any) => err.response);
    expect(anonymousPut.status).toEqual(403);
  });

  test("Ingest evaluates gates and stores status + results", async () => {
    await TestHelpers.sendReport({
      meta: { key: "gated", processor: "json", jsonPayload: { metrics: [] } },
      authToken,
    });
    const saved = await TestHelpers.setGates(authToken, "gated", [
      { metric: "tests.failed", operator: "<=", failValue: 0 },
    ]);
    expect(saved.status).toEqual(200);
    expect(saved.data.gates.length).toEqual(1);
    expect(saved.data.gates[0].id).toBeTruthy();

    const failing = await TestHelpers.sendReport({
      meta: {
        key: "gated",
        processor: "json",
        jsonPayload: {
          metrics: [{ name: "tests.failed", type: "count", value: 2 }],
        },
      },
      authToken,
    });
    expect(failing.status).toEqual(201);
    expect(failing.data.version.gateStatus).toEqual("fail");
    expect(failing.data.version.gateResults.length).toEqual(1);
    expect(failing.data.version.gateResults[0].value).toEqual(2);

    const passing = await TestHelpers.sendReport({
      meta: {
        key: "gated",
        processor: "json",
        jsonPayload: {
          metrics: [{ name: "tests.failed", type: "count", value: 0 }],
        },
      },
      authToken,
    });
    expect(passing.data.version.gateStatus).toEqual("pass");

    const warn = await TestHelpers.setGates(authToken, "gated", [
      { metric: "tests.failed", operator: "<=", warnValue: 1, failValue: 5 },
    ]);
    expect(warn.status).toEqual(200);

    const warned = await TestHelpers.sendReport({
      meta: {
        key: "gated",
        processor: "json",
        jsonPayload: {
          metrics: [{ name: "tests.failed", type: "count", value: 3 }],
        },
      },
      authToken,
    });
    expect(warned.data.version.gateStatus).toEqual("warn");
  });

  test("No rules ⇒ gateStatus null", async () => {
    const response = await TestHelpers.sendReport({
      meta: {
        key: "ungated",
        processor: "json",
        jsonPayload: {
          metrics: [{ name: "tests.failed", type: "count", value: 3 }],
        },
      },
      authToken,
    });
    expect(response.data.version.gateStatus).toBeNull();
    expect(response.data.version.gateResults).toEqual([]);
  });

  test("Missing metric rule is skipped", async () => {
    await TestHelpers.sendReport({
      meta: { key: "partial", processor: "json", jsonPayload: { metrics: [] } },
      authToken,
    });
    await TestHelpers.setGates(authToken, "partial", [
      { metric: "coverage.lines", operator: ">=", failValue: 80 },
    ]);
    const response = await TestHelpers.sendReport({
      meta: {
        key: "partial",
        processor: "json",
        jsonPayload: {
          metrics: [{ name: "tests.failed", type: "count", value: 0 }],
        },
      },
      authToken,
    });
    expect(response.data.version.gateStatus).toBeNull();
  });

  test("PUT gates retro-applies to existing versions", async () => {
    const upload = await TestHelpers.sendReport({
      meta: {
        key: "retro",
        processor: "json",
        jsonPayload: {
          metrics: [{ name: "tests.failed", type: "count", value: 2 }],
        },
      },
      authToken,
    });
    expect(upload.data.version.gateStatus).toBeNull();
    const versionsBefore = await axios.get(
      `${Config.APIURL}/reports/retro/versions`,
    );
    expect(versionsBefore.data.versions[0].gateStatus).toBeNull();

    const saved = await TestHelpers.setGates(authToken, "retro", [
      { metric: "tests.failed", operator: "<=", failValue: 0 },
    ]);
    expect(saved.status).toEqual(200);

    const versionsAfter = await axios.get(
      `${Config.APIURL}/reports/retro/versions`,
    );
    expect(versionsAfter.data.versions[0].gateStatus).toEqual("fail");
  });

  test("Report list includes gate fields on latestVersion", async () => {
    await TestHelpers.sendReport({
      meta: { key: "list-gates", processor: "json", jsonPayload: { metrics: [] } },
      authToken,
    });
    await TestHelpers.setGates(authToken, "list-gates", [
      { metric: "tests.failed", operator: "<=", failValue: 0 },
    ]);
    await TestHelpers.sendReport({
      meta: {
        key: "list-gates",
        processor: "json",
        jsonPayload: {
          metrics: [{ name: "tests.failed", type: "count", value: 1 }],
        },
      },
      authToken,
    });
    const reports = await axios.get(`${Config.APIURL}/reports`);
    const report = reports.data.reports.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (r: any) => r.key === "list-gates",
    );
    expect(report.latestVersion.gateStatus).toEqual("fail");
    expect(report.latestVersion.gateResults.length).toEqual(1);
  });
});

describe("/api/reports/:key/badge.svg", () => {
  //
  let authToken: string;
  const uploadToken = "badge-token";

  beforeEach(async () => {
    authToken = await TestHelpers.resetAll();
    await TestHelpers.sendReport({
      meta: { key: "badged", processor: "json", jsonPayload: { metrics: [] } },
      authToken,
    });
    await TestHelpers.setGates(authToken, "badged", [
      { metric: "tests.failed", operator: "<=", failValue: 0 },
    ]);
    await TestHelpers.sendReport({
      meta: {
        key: "badged",
        processor: "json",
        jsonPayload: {
          metrics: [{ name: "tests.failed", type: "count", value: 0 }],
        },
      },
      authToken,
    });
  });

  test("Public dashboard: anonymous badge is 200 svg", async () => {
    await TestHelpers.setSettings(authToken, {
      isDashboardPublic: true,
      uploadToken,
    });
    const response = await get(
      `${Config.APIURL}/reports/${encodeURIComponent("badged")}/badge.svg`,
    );
    expect(response.status).toEqual(200);
    expect(response.headers["content-type"]).toContain("image/svg+xml");
    expect(response.data).toContain("passing");
  });

  test("Private dashboard: anonymous badge is 403, token badge is 200", async () => {
    await TestHelpers.setSettings(authToken, {
      isDashboardPublic: false,
      uploadToken,
    });
    const anonymous = await get(
      `${Config.APIURL}/reports/${encodeURIComponent("badged")}/badge.svg`,
    );
    expect(anonymous.status).toEqual(403);
    const withToken = await get(
      `${Config.APIURL}/reports/${encodeURIComponent("badged")}/badge.svg?token=${uploadToken}`,
    );
    expect(withToken.status).toEqual(200);
    expect(withToken.data).toContain("<svg");
  });

  test("Unknown report badge is 404", async () => {
    const response = await get(`${Config.APIURL}/reports/nope/badge.svg`);
    expect(response.status).toEqual(404);
  });
});

describe("webhook notification on gate failure", () => {
  //
  let authToken: string;
  let receiver: http.Server;
  let received: any[];
  let receiverUrl: string;

  beforeAll((done) => {
    receiver = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          received.push(JSON.parse(body));
        } catch {
          received.push(body);
        }
        res.writeHead(200);
        res.end();
      });
    });
    receiver.listen(0, "127.0.0.1", () => {
      const address = receiver.address() as { port: number };
      receiverUrl = `http://127.0.0.1:${address.port}/hook`;
      done();
    });
  });

  afterAll((done) => {
    receiver.close(() => done());
  });

  beforeEach(async () => {
    received = [];
    authToken = await TestHelpers.resetAll();
    await TestHelpers.setSettings(authToken, { isDashboardPublic: true });
  });

  test("POSTs payload when a version fails its gate", async () => {
    await TestHelpers.setSettings(authToken, {
      isDashboardPublic: true,
      webhookUrl: receiverUrl,
    });
    await TestHelpers.sendReport({
      meta: { key: "hooked", processor: "json", jsonPayload: { metrics: [] } },
      authToken,
    });
    await TestHelpers.setGates(authToken, "hooked", [
      { metric: "tests.failed", operator: "<=", failValue: 0 },
    ]);
    const response = await TestHelpers.sendReport({
      meta: {
        key: "hooked",
        processor: "json",
        jsonPayload: {
          metrics: [{ name: "tests.failed", type: "count", value: 1 }],
        },
      },
      authToken,
    });
    expect(response.status).toEqual(201);
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(received.length).toEqual(1);
    expect(received[0].event).toEqual("quality.gate.failed");
    expect(received[0].report.key).toEqual("hooked");
    expect(received[0].gate.status).toEqual("fail");
    expect(received[0].metrics.length).toEqual(1);
  });

  test("No POST for passing versions or empty webhookUrl", async () => {
    await TestHelpers.sendReport({
      meta: { key: "calm", processor: "json", jsonPayload: { metrics: [] } },
      authToken,
    });
    await TestHelpers.setGates(authToken, "calm", [
      { metric: "tests.failed", operator: "<=", failValue: 0 },
    ]);
    // webhookUrl empty (default): failing upload must not notify
    const failing = await TestHelpers.sendReport({
      meta: {
        key: "calm",
        processor: "json",
        jsonPayload: {
          metrics: [{ name: "tests.failed", type: "count", value: 5 }],
        },
      },
      authToken,
    });
    expect(failing.data.version.gateStatus).toEqual("fail");

    // webhookUrl set but passing upload: no notification
    await TestHelpers.setSettings(authToken, {
      isDashboardPublic: true,
      webhookUrl: receiverUrl,
    });
    await TestHelpers.sendReport({
      meta: {
        key: "calm",
        processor: "json",
        jsonPayload: {
          metrics: [{ name: "tests.failed", type: "count", value: 0 }],
        },
      },
      authToken,
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(received.length).toEqual(0);
  });
});
