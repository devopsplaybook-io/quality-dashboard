import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthService } from "~~/services/AuthService";
import {
  createLoginCodeService,
  isLoginCodeAvailable,
} from "~~/utils/loginCodes";

const iso = new Date(Date.now() + 300_000).toISOString();

function noAuth() {
  return vi.spyOn(AuthService, "getAuthHeader").mockResolvedValue({});
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createLoginCodeService", () => {
  it("probes the default route prefix (/api/users/login-codes) with the default timeout", async () => {
    const get = vi.fn().mockResolvedValue({
      data: { enabled: true, available: true },
    });
    const service = createLoginCodeService({ http: { get, post: vi.fn() } });
    noAuth();

    await service.capabilities();

    expect(get).toHaveBeenCalledWith(
      "/api/users/login-codes/capabilities",
      expect.objectContaining({ timeout: 10_000 }),
    );
  });

  it("persists the session token when a poll is approved", async () => {
    const saveToken = vi.spyOn(AuthService, "saveToken").mockResolvedValue();
    const post = vi.fn().mockResolvedValue({
      data: {
        status: "approved",
        token: "minted",
        user: { id: "user-1", name: "ann" },
        expiresAt: iso,
        serverTime: iso,
      },
    });
    const service = createLoginCodeService({ http: { get: vi.fn(), post } });

    const result = await service.poll("request-token");

    expect(result.status).toBe("approved");
    expect(post).toHaveBeenCalledWith(
      "/api/users/login-codes/poll",
      { requestToken: "request-token" },
      expect.anything(),
    );
    expect(saveToken).toHaveBeenCalledWith("minted");
  });

  it("sends the Authorization header on preview and approve", async () => {
    vi.spyOn(AuthService, "getAuthHeader").mockResolvedValue({
      headers: { Authorization: "Bearer session-token" },
    });
    const post = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          deviceLabel: "Chrome on macOS",
          userAgent: "test-agent",
          createdAt: iso,
          expiresAt: iso,
          userName: "ann",
          serverTime: iso,
        },
      })
      .mockResolvedValueOnce({
        data: { approved: true, expiresAt: iso, serverTime: iso },
      });
    const service = createLoginCodeService({ http: { get: vi.fn(), post } });

    await service.preview("BCDFGHJK");
    await service.approve({ code: "BCDFGHJK" });

    expect(post.mock.calls[0][0]).toBe("/api/users/login-codes/preview");
    expect(post.mock.calls[0][1]).toEqual({ code: "BCDFGHJK" });
    expect(
      (post.mock.calls[0][2] as { headers?: Record<string, string> }).headers,
    ).toEqual({ Authorization: "Bearer session-token" });

    expect(post.mock.calls[1][0]).toBe("/api/users/login-codes/approve");
    expect(
      (post.mock.calls[1][2] as { headers?: Record<string, string> }).headers,
    ).toEqual({ Authorization: "Bearer session-token" });
  });
});

describe("isLoginCodeAvailable", () => {
  it("is true when the server reports enabled and available", async () => {
    const service = createLoginCodeService({
      http: {
        get: vi.fn().mockResolvedValue({
          data: { enabled: true, available: true },
        }),
        post: vi.fn(),
      },
    });
    await expect(isLoginCodeAvailable(service)).resolves.toBe(true);
  });

  it("is false when the feature is disabled", async () => {
    const service = createLoginCodeService({
      http: {
        get: vi.fn().mockResolvedValue({
          data: { enabled: true, available: false },
        }),
        post: vi.fn(),
      },
    });
    await expect(isLoginCodeAvailable(service)).resolves.toBe(false);
  });

  it("is false when the probe fails (routes not mounted)", async () => {
    const service = createLoginCodeService({
      http: { get: vi.fn().mockRejectedValue(new Error("404")), post: vi.fn() },
    });
    await expect(isLoginCodeAvailable(service)).resolves.toBe(false);
  });
});
