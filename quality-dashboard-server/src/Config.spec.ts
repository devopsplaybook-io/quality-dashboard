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
    expect(config.JWT_VALIDITY_DURATION).toBe(31 * 24 * 3600);
  });

  it("should have a generated JWT key", () => {
    const config = new Config();
    expect(config.JWT_KEY).toBeTruthy();
    expect(typeof config.JWT_KEY).toBe("string");
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
});
