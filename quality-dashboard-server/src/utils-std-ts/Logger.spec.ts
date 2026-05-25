import { Logger } from "./Logger";

describe("Logger", () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it("should log info messages with module name", () => {
    const logger = new Logger("test-module");
    logger.info("hello world");
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "[info] [test-module] hello world",
    );
  });

  it("should log warn messages", () => {
    const logger = new Logger("warn-module");
    logger.warn("warning message");
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "[warn] [warn-module] warning message",
    );
  });

  it("should log error messages", () => {
    const logger = new Logger("err-module");
    logger.error("error message");
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "[error] [err-module] error message",
    );
  });

  it("should log Error objects with stack trace", () => {
    const logger = new Logger("err-module");
    const err = new Error("something broke");
    logger.error(err);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "error [err-module] Error: something broke",
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(err.stack);
  });

  it("should log object messages as JSON", () => {
    const logger = new Logger("obj-module");
    logger.info({ foo: "bar", num: 42 });
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'info [obj-module] {"foo":"bar","num":42}',
    );
  });
});
