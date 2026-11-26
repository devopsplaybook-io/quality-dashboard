import { Config } from "./Config";

describe("Config", () => {
  it("should have default service ID", () => {
    const config = new Config();
    expect(config.SERVICE_ID).toBe("quality-dashboard-server");
  });

  it("should have default API port", () => {
    const config = new Config();
    expect(config.API_PORT).toBe(8080);
  });

  it("should have default JWT validity duration", () => {
    const config = new Config();
    // Literal effective value: 93 days, pinned by the session policy doc.
    expect(config.JWT_VALIDITY_DURATION).toBe(8035200);
    // Inherited from common-utils but unused: users/Auth.ts signs
    // exp = now + JWT_VALIDITY_DURATION and never enforces an absolute cap.
    expect(config.JWT_SESSION_MAX_DURATION).toBe(2592000);
  });

  it("should default the JWT key to the DB-managed value", () => {
    const config = new Config();
    expect(typeof config.JWT_KEY).toBe("string");
    expect(config.JWT_KEY).toBe("");
  });

  it("should have default version", () => {
    const config = new Config();
    expect(config.VERSION).toBe("2");
  });

  it("should read TMP_DIR from environment or default", () => {
    const config = new Config();
    expect(config.TMP_DIR).toBe(process.env.TMP_DIR || "/tmp");
  });

  it("should read DATA_DIR from environment or default", () => {
    const config = new Config();
    expect(config.DATA_DIR).toBe(process.env.DATA_DIR || "/data");
  });

  it("should update REPORT_DIR when DATA_DIR changes after reload", async () => {
    const config = new Config();
    await config.reload();
    expect(config.REPORT_DIR).toBe(config.DATA_DIR + "/reports");
  });

  it("should keep the application JWT validity and version after reload", async () => {
    const config = new Config();
    await config.reload();
    // 93 days survives reload because the field is re-registered; there is no
    // absolute cap in this app (the inherited cap field is never enforced).
    expect(config.JWT_VALIDITY_DURATION).toBe(8035200);
    expect(config.JWT_SESSION_MAX_DURATION).toBe(2592000);
    expect(config.VERSION).toBe("2");
  });

  it("should disable login with a code by default", async () => {
    const config = new Config();
    expect(config.LOGIN_CODE_ENABLED).toBe(false);
    await config.reload();
    expect(config.LOGIN_CODE_ENABLED).toBe(false);
  });

  it("should enable login with a code from the environment", async () => {
    const previous = process.env.LOGIN_CODE_ENABLED;
    process.env.LOGIN_CODE_ENABLED = "true";
    try {
      const config = new Config();
      await config.reload();
      expect(config.LOGIN_CODE_ENABLED).toBe(true);
    } finally {
      if (previous === undefined) {
        delete process.env.LOGIN_CODE_ENABLED;
      } else {
        process.env.LOGIN_CODE_ENABLED = previous;
      }
    }
  });
});
