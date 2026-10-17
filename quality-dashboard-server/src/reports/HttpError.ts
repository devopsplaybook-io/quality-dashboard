export class HttpError extends Error {
  public readonly status: number;
  public readonly details?: Record<string, unknown>;
  constructor(
    status: number,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
