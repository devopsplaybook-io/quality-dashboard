import { describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import type { LoginCodeService } from "@devopsplaybook.io/common-web/services/LoginCodeService";
import LoginWithCodeCard from "@devopsplaybook.io/common-web/components/LoginWithCodeCard.vue";
import AuthorizeDeviceCard from "@devopsplaybook.io/common-web/components/AuthorizeDeviceCard.vue";

const iso = new Date(Date.now() + 300_000).toISOString();

function capabilities(overrides: Record<string, unknown> = {}) {
  return {
    enabled: true,
    available: true,
    codeLength: 8,
    rotationSeconds: 30,
    graceSeconds: 60,
    ttlSeconds: 300,
    pollIntervalMs: 2000,
    approveRequiresPassword: false,
    serverTime: iso,
    ...overrides,
  };
}

function stubService(overrides: Record<string, unknown> = {}) {
  return {
    capabilities: vi.fn().mockResolvedValue(capabilities()),
    create: vi.fn().mockResolvedValue({
      requestToken: "request-token",
      code: "BCDFGHJK",
      codeExpiresAt: iso,
      expiresAt: iso,
      serverTime: iso,
    }),
    poll: vi.fn().mockResolvedValue({
      status: "pending",
      codeExpiresAt: iso,
      expiresAt: iso,
      serverTime: iso,
    }),
    cancel: vi.fn().mockResolvedValue({ status: "cancelled", serverTime: iso }),
    preview: vi.fn(),
    approve: vi.fn(),
    ...overrides,
  } as unknown as LoginCodeService;
}

describe("LoginWithCodeCard", () => {
  it("renders the h2 title with aria-labelledby in the card variant", async () => {
    const service = stubService();
    const wrapper = mount(LoginWithCodeCard, {
      props: { service, autoStart: false },
    });
    await flushPromises();

    const heading = wrapper.find("h2");
    expect(heading.text()).toContain("Sign in with a code");
    expect(wrapper.find("section").attributes("aria-labelledby")).toBe(
      heading.attributes("id"),
    );
    wrapper.unmount();
  });

  it("renders an h3 title in the plain variant with headingLevel 3", async () => {
    const wrapper = mount(LoginWithCodeCard, {
      props: { service: stubService(), autoStart: false, variant: "plain", headingLevel: 3 },
    });
    await flushPromises();

    expect(wrapper.find("h3").text()).toContain("Sign in with a code");
    expect(wrapper.find("h2").exists()).toBe(false);
    wrapper.unmount();
  });

  it("stays inert with autoStart false", async () => {
    const service = stubService();
    const wrapper = mount(LoginWithCodeCard, {
      props: { service, autoStart: false },
    });
    await flushPromises();

    expect(service.create).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("Preparing a code…");
    wrapper.unmount();
  });

  it("shows the unavailable message when capabilities are disabled", async () => {
    const service = stubService({
      capabilities: vi
        .fn()
        .mockResolvedValue(capabilities({ enabled: false, available: false })),
    });
    const wrapper = mount(LoginWithCodeCard, { props: { service } });
    await flushPromises();
    await flushPromises();

    expect(wrapper.text()).toContain("Login with a code is unavailable");
    expect(service.create).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("renders the formatted code once the request is created", async () => {
    const wrapper = mount(LoginWithCodeCard, { props: { service: stubService() } });
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain("BCDF-GHJK");
    });
    wrapper.unmount();
  });
});

describe("AuthorizeDeviceCard", () => {
  it("renders the h2 title in the card variant", async () => {
    const wrapper = mount(AuthorizeDeviceCard, { props: { service: stubService() } });
    await flushPromises();

    expect(wrapper.find("h2").text()).toContain("Approve a sign-in");
    wrapper.unmount();
  });

  it("renders an h3 title in the plain variant with headingLevel 3", async () => {
    const wrapper = mount(AuthorizeDeviceCard, {
      props: { service: stubService(), variant: "plain", headingLevel: 3 },
    });
    await flushPromises();

    expect(wrapper.find("h3").text()).toContain("Approve a sign-in");
    wrapper.unmount();
  });

  it("shows unavailable state and disables the input", async () => {
    const service = stubService({
      capabilities: vi
        .fn()
        .mockResolvedValue(capabilities({ enabled: true, available: false })),
    });
    const wrapper = mount(AuthorizeDeviceCard, { props: { service } });
    await flushPromises();

    expect(wrapper.text()).toContain("Login with a code is unavailable");
    expect(wrapper.find("input").attributes("disabled")).toBeDefined();
    wrapper.unmount();
  });

  it("previews a normalized code and emits approved", async () => {
    const preview = vi.fn().mockResolvedValue({
      deviceLabel: "Chrome on macOS",
      userAgent: "test-agent",
      createdAt: iso,
      expiresAt: iso,
      userName: "ann",
      serverTime: iso,
    });
    const approve = vi
      .fn()
      .mockResolvedValue({ approved: true, expiresAt: iso, serverTime: iso });
    const wrapper = mount(AuthorizeDeviceCard, {
      props: { service: stubService({ preview, approve }) },
    });
    await flushPromises();

    await wrapper.find("input[type=text]").setValue("bcdf-ghjk");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(preview).toHaveBeenCalledWith("BCDFGHJK", expect.anything());
    expect(wrapper.text()).toContain("ann");

    const approveButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("Approve sign-in"));
    expect(approveButton).toBeDefined();
    await approveButton!.trigger("click");
    await flushPromises();

    expect(approve).toHaveBeenCalledWith(
      { code: "BCDFGHJK" },
      expect.anything(),
    );
    expect(wrapper.emitted("approved")).toBeTruthy();
    wrapper.unmount();
  });
});
