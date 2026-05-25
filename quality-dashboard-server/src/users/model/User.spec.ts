import { User } from "./User";

describe("User", () => {
  it("should create a user with default UUID and user role", () => {
    const user = new User();
    expect(user.id).toBeTruthy();
    expect(typeof user.id).toBe("string");
    expect(user.role).toBe("user");
    expect(user.permissions).toEqual({
      canConfigureDashboards: false,
      canConfigureReportTags: false,
    });
    expect(user.name).toBeUndefined();
    expect(user.passwordEncrypted).toBeUndefined();
  });

  it("should have unique IDs for different instances", () => {
    const user1 = new User();
    const user2 = new User();
    expect(user1.id).not.toBe(user2.id);
  });

  describe("toJson", () => {
    it("should include all fields including password", () => {
      const user = new User();
      user.name = "testuser";
      user.passwordEncrypted = "hashedPwd";
      user.role = "admin";
      user.permissions = {
        canConfigureDashboards: true,
        canConfigureReportTags: true,
      };
      const json = user.toJson();
      expect(json.id).toBe(user.id);
      expect(json.name).toBe("testuser");
      expect(json.passwordEncrypted).toBe("hashedPwd");
      expect(json.role).toBe("admin");
      expect(json.permissions.canConfigureDashboards).toBe(true);
    });
  });

  describe("toTransportJson", () => {
    it("should not expose password field", () => {
      const user = new User();
      user.name = "testuser";
      user.passwordEncrypted = "hashedPwd";
      const json = user.toTransportJson();
      expect(json.id).toBe(user.id);
      expect(json.name).toBe("testuser");
      expect(json.passwordEncrypted).toBeUndefined();
      expect(json.role).toBe("user");
    });
  });

  describe("fromJson", () => {
    it("should return null for null input", () => {
      expect(User.fromJson(null)).toBeNull();
    });

    it("should parse a valid JSON object", () => {
      const json = {
        id: "custom-id",
        name: "jsonuser",
        passwordEncrypted: "encrypted",
        role: "admin",
        permissions: {
          canConfigureDashboards: true,
          canConfigureReportTags: false,
        },
      };
      const user = User.fromJson(json);
      expect(user.id).toBe("custom-id");
      expect(user.name).toBe("jsonuser");
      expect(user.passwordEncrypted).toBe("encrypted");
      expect(user.role).toBe("admin");
      expect(user.permissions.canConfigureDashboards).toBe(true);
      expect(user.permissions.canConfigureReportTags).toBe(false);
    });

    it("should default to user role when not provided", () => {
      const json = { name: "regular" };
      const user = User.fromJson(json);
      expect(user.role).toBe("user");
    });

    it("should parse permissions from JSON string", () => {
      const json = {
        name: "permUser",
        permissions: JSON.stringify({
          canConfigureDashboards: true,
          canConfigureReportTags: true,
        }),
      };
      const user = User.fromJson(json);
      expect(user.permissions.canConfigureDashboards).toBe(true);
      expect(user.permissions.canConfigureReportTags).toBe(true);
    });

    it("should use default permissions when parsing fails", () => {
      const json = {
        name: "badPermUser",
        permissions: "not-valid-json",
      };
      const user = User.fromJson(json);
      expect(user.permissions.canConfigureDashboards).toBe(false);
      expect(user.permissions.canConfigureReportTags).toBe(false);
    });
  });
});
