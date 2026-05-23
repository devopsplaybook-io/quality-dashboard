import { Span } from "@opentelemetry/sdk-trace-base";
import { Config } from "../Config";
import { OTelTracer } from "../OTelContext";
import {
  SqlDbUtilsExecSQL,
  SqlDbUtilsQuerySQL,
} from "../utils-std-ts/SqlDbUtils";

export interface SettingsValue {
  isDashboardPublic: boolean;
  uploadToken: string;
}

const KEY = "settings_v2";
const DEFAULT: SettingsValue = { isDashboardPublic: false, uploadToken: "" };

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class SettingsDB {
  //
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public static async init(context: Span, _config: Config): Promise<void> {
    const span = OTelTracer().startSpan("SettingsDB_init", context);
    try {
      const rows = SqlDbUtilsQuerySQL(
        span,
        "SELECT value FROM metadata WHERE type = ?",
        [KEY] as never[],
      );
      if (rows.length === 0) {
        SqlDbUtilsExecSQL(
          span,
          "INSERT INTO metadata (type, value, dateCreated) VALUES (?, ?, ?)",
          [KEY, JSON.stringify(DEFAULT), new Date().toISOString()] as never[],
        );
      }
    } finally {
      span.end();
    }
  }

  public static async get(context: Span): Promise<SettingsValue> {
    const span = OTelTracer().startSpan("SettingsDB_get", context);
    try {
      const rows = SqlDbUtilsQuerySQL(
        span,
        "SELECT value FROM metadata WHERE type = ?",
        [KEY] as never[],
      );
      if (rows.length === 0) {
        return { ...DEFAULT };
      }
      try {
        const parsed = JSON.parse(rows[0].value);
        return {
          isDashboardPublic: !!parsed.isDashboardPublic,
          uploadToken:
            typeof parsed.uploadToken === "string" ? parsed.uploadToken : "",
        };
      } catch {
        return { ...DEFAULT };
      }
    } finally {
      span.end();
    }
  }

  public static async update(
    context: Span,
    settings: Partial<SettingsValue>,
  ): Promise<SettingsValue> {
    const span = OTelTracer().startSpan("SettingsDB_update", context);
    try {
      const current = await SettingsDB.get(span);
      const next: SettingsValue = {
        isDashboardPublic:
          typeof settings.isDashboardPublic === "boolean"
            ? settings.isDashboardPublic
            : current.isDashboardPublic,
        uploadToken:
          typeof settings.uploadToken === "string"
            ? settings.uploadToken
            : current.uploadToken,
      };
      SqlDbUtilsExecSQL(span, "DELETE FROM metadata WHERE type = ?", [
        KEY,
      ] as never[]);
      SqlDbUtilsExecSQL(
        span,
        "INSERT INTO metadata (type, value, dateCreated) VALUES (?, ?, ?)",
        [KEY, JSON.stringify(next), new Date().toISOString()] as never[],
      );
      return next;
    } finally {
      span.end();
    }
  }
}
