import { TestHelpers } from "./TestHelpers";

describe("/api/reports/ (with upload token)", () => {
  //
  let authToken: string;
  const uploadToken = "abcd";

  beforeEach(async () => {
    authToken = await TestHelpers.resetAll();
    await TestHelpers.setSettings(authToken, {
      isDashboardPublic: true,
      uploadToken,
    });
  });

  test("Accepts upload with valid token", async () => {
    const response = await TestHelpers.sendReport({
      meta: {
        key: "via-token",
        processor: "json",
        jsonPayload: { metrics: [{ name: "x", type: "count", value: 1 }] },
      },
      uploadToken,
    });
    expect(response.status).toEqual(201);
  });

  test("Rejects upload when token missing", async () => {
    const response = await TestHelpers.sendReport({
      meta: {
        key: "no-token",
        processor: "json",
        jsonPayload: { metrics: [] },
      },
    });
    expect(response.status).toEqual(403);
  });

  test("Rejects upload when token wrong", async () => {
    const response = await TestHelpers.sendReport({
      meta: {
        key: "wrong-token",
        processor: "json",
        jsonPayload: { metrics: [] },
      },
      uploadToken: "wrong",
    });
    expect(response.status).toEqual(403);
  });

  test("Authenticated upload works regardless of token", async () => {
    const response = await TestHelpers.sendReport({
      meta: {
        key: "via-auth",
        processor: "json",
        jsonPayload: { metrics: [{ name: "x", type: "count", value: 2 }] },
      },
      authToken,
    });
    expect(response.status).toEqual(201);
  });
});
