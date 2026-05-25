import axios from "axios";
import { Config } from "./Config";
import { TestHelpers } from "./TestHelpers";

describe("/api/reports/ (public access)", () => {
  //
  let authToken: string;

  beforeEach(async () => {
    authToken = await TestHelpers.resetAll();
    await TestHelpers.setSettings(authToken, { isDashboardPublic: true });
    await TestHelpers.sendReport({
      meta: {
        key: "public-test",
        processor: "json",
        jsonPayload: {
          metrics: [{ name: "x", type: "count", value: 1 }],
        },
      },
      authToken,
    });
  });

  test("Anonymous can list reports when public", async () => {
    const response = await axios.get(`${Config.APIURL}/reports`);
    expect(response.status).toEqual(200);
    expect(response.data.reports.length).toBeGreaterThan(0);
  });

  test("Anonymous cannot list reports when private", async () => {
    await TestHelpers.setSettings(authToken, { isDashboardPublic: false });
    const response = await axios
      .get(`${Config.APIURL}/reports`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .catch((err: any) => err.response);
    expect(response.status).toEqual(403);
  });

  test("Authenticated can list reports when private", async () => {
    await TestHelpers.setSettings(authToken, { isDashboardPublic: false });
    const response = await axios.get(`${Config.APIURL}/reports`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.status).toEqual(200);
  });
});
