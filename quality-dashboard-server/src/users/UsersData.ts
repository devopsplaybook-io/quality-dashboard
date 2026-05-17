import { Span } from "@opentelemetry/sdk-trace-base";
import { User } from "./model/User";
import { OTelLogger, OTelTracer } from "../OTelContext";
import {
  SqlDbUtilsExecSQL,
  SqlDbUtilsQuerySQL,
} from "../utils-std-ts/SqlDbUtils";

export class UsersData {
  //
  public static async get(context: Span, id: string): Promise<User> {
    const span = OTelTracer().startSpan("UsersData_get", context);
    const usersRaw = SqlDbUtilsQuerySQL(
      span,
      "SELECT * FROM users WHERE id=?",
      [id],
    );
    let user: User = null;
    if (usersRaw.length > 0) {
      user = UsersData.fromRaw(usersRaw[0]);
    }
    span.end();
    return user;
  }

  public static async getByName(context: Span, name: string): Promise<User> {
    const span = OTelTracer().startSpan("UsersData_getByName", context);
    const usersRaw = SqlDbUtilsQuerySQL(
      span,
      "SELECT * FROM users WHERE name=?",
      [name],
    );
    let user: User = null;
    if (usersRaw.length > 0) {
      user = UsersData.fromRaw(usersRaw[0]);
    }
    span.end();
    return user;
  }

  public static async list(context: Span): Promise<User[]> {
    const span = OTelTracer().startSpan("UsersData_list", context);
    const usersRaw = SqlDbUtilsQuerySQL(span, "SELECT * FROM users");
    const users = [];
    for (const userRaw of usersRaw) {
      users.push(UsersData.fromRaw(userRaw));
    }
    span.end();
    return users;
  }

  public static async add(context: Span, user: User): Promise<void> {
    const span = OTelTracer().startSpan("UsersData_add", context);
    SqlDbUtilsExecSQL(
      span,
      "INSERT INTO users (id,name,passwordEncrypted,role,permissions) VALUES (?, ?, ?, ?, ?)",
      [
        user.id,
        user.name,
        user.passwordEncrypted,
        user.role,
        JSON.stringify(user.permissions),
      ],
    );
    span.end();
  }

  public static async updatePassword(context: Span, user: User): Promise<void> {
    const span = OTelTracer().startSpan("UsersData_updatePassword", context);
    SqlDbUtilsExecSQL(
      span,
      "UPDATE users SET passwordEncrypted = ? WHERE id = ?",
      [user.passwordEncrypted, user.id],
    );
    span.end();
  }

  public static async updateUser(context: Span, user: User): Promise<void> {
    const span = OTelTracer().startSpan("UsersData_updateUser", context);
    SqlDbUtilsExecSQL(
      span,
      "UPDATE users SET role = ?, permissions = ? WHERE id = ?",
      [user.role, JSON.stringify(user.permissions), user.id],
    );
    span.end();
  }

  public static async delete(context: Span, id: string): Promise<void> {
    const span = OTelTracer().startSpan("UsersData_delete", context);
    SqlDbUtilsExecSQL(span, "DELETE FROM users WHERE id = ?", [id]);
    span.end();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static fromRaw(userRaw: any): User {
    const user = new User();
    user.id = userRaw.id;
    user.name = userRaw.name;
    user.passwordEncrypted = userRaw.passwordEncrypted;
    user.role = userRaw.role || "user";
    if (userRaw.permissions) {
      try {
        user.permissions = JSON.parse(userRaw.permissions);
      } catch {
        user.permissions = { ...User.DEFAULT_PERMISSIONS };
      }
    }
    return user;
  }
}
