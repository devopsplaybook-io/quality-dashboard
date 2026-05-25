import { HttpError } from "./ReportsService";

describe("HttpError", () => {
  it("should create error with status and message", () => {
    const err = new HttpError(400, "Bad request");
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(400);
    expect(err.message).toBe("Bad request");
  });

  it("should create error with 500 status", () => {
    const err = new HttpError(500, "Internal error");
    expect(err.status).toBe(500);
    expect(err.message).toBe("Internal error");
  });
});
