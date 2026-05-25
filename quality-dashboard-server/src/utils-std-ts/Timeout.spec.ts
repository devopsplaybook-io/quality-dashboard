import { TimeoutWait } from "./Timeout";

describe("TimeoutWait", () => {
  it("should resolve after the specified duration", async () => {
    const start = Date.now();
    await TimeoutWait(50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40);
  });

  it("should resolve immediately for duration 0", async () => {
    const start = Date.now();
    await TimeoutWait(0);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(50);
  });
});
