import { v4 as uuidv4 } from "uuid";

export interface UserPermissions {
  canConfigureDashboards: boolean;
  canConfigureReportTags: boolean;
}

export type UserRole = "admin" | "user";

export class User {
  //
  public static readonly DEFAULT_PERMISSIONS: UserPermissions = {
    canConfigureDashboards: false,
    canConfigureReportTags: false,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static fromJson(json: any): User {
    if (!json) {
      return null;
    }
    const user = new User();
    if (json.id) {
      user.id = json.id;
    }
    user.id = json.id;
    user.name = json.name;
    user.passwordEncrypted = json.passwordEncrypted;
    user.role = json.role || "user";
    if (json.permissions) {
      try {
        user.permissions =
          typeof json.permissions === "string"
            ? JSON.parse(json.permissions)
            : json.permissions;
      } catch {
        user.permissions = { ...User.DEFAULT_PERMISSIONS };
      }
    }
    return user;
  }

  public id: string;
  public name: string;
  public passwordEncrypted: string;
  public role: UserRole = "user";
  public permissions: UserPermissions = { ...User.DEFAULT_PERMISSIONS };

  constructor() {
    this.id = uuidv4();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public toJson(): any {
    return {
      id: this.id,
      name: this.name,
      passwordEncrypted: this.passwordEncrypted,
      role: this.role,
      permissions: this.permissions,
    };
  }

  public toTransportJson(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      role: this.role,
      permissions: this.permissions,
    };
  }
}
