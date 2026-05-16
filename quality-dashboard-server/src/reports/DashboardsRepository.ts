import { Span } from "@opentelemetry/sdk-trace-base";
import { OTelTracer } from "../OTelContext";
import {
  SqlDbUtilsExecSQL,
  SqlDbUtilsQuerySQL,
} from "../utils-std-ts/SqlDbUtils";
import { Dashboard, DashboardLevel } from "./models/Dashboard";

/**
 * Persistence for user-defined Dashboards.
 * A Dashboard is an ordered list of levels.
 * Each level is { tag, value? } — see models/Dashboard.ts.
 */
export class DashboardsRepository {
  //
  public static async add(context: Span, dashboard: Dashboard): Promise<void> {
    const span = OTelTracer().startSpan("DashboardsRepository_add", context);
    try {
      SqlDbUtilsExecSQL(
        span,
        `INSERT INTO dashboards (id, name, levels, date_created, date_modified)
         VALUES (?, ?, ?, ?, ?)`,
        [
          dashboard.id,
          dashboard.name,
          JSON.stringify(dashboard.levels || []),
          dashboard.dateCreated.toISOString(),
          dashboard.dateModified.toISOString(),
        ] as never[],
      );
    } finally {
      span.end();
    }
  }

  public static async list(context: Span): Promise<Dashboard[]> {
    const span = OTelTracer().startSpan("DashboardsRepository_list", context);
    try {
      const rows = SqlDbUtilsQuerySQL(
        span,
        "SELECT * FROM dashboards ORDER BY name ASC",
      );
      return rows.map((r) => DashboardsRepository.fromRaw(r));
    } finally {
      span.end();
    }
  }

  public static async getById(
    context: Span,
    id: string,
  ): Promise<Dashboard | null> {
    const span = OTelTracer().startSpan(
      "DashboardsRepository_getById",
      context,
    );
    try {
      const rows = SqlDbUtilsQuerySQL(
        span,
        "SELECT * FROM dashboards WHERE id = ?",
        [id] as never[],
      );
      return rows.length === 0 ? null : DashboardsRepository.fromRaw(rows[0]);
    } finally {
      span.end();
    }
  }

  public static async update(
    context: Span,
    id: string,
    name: string,
    levels: DashboardLevel[],
  ): Promise<boolean> {
    const span = OTelTracer().startSpan("DashboardsRepository_update", context);
    try {
      const changed = SqlDbUtilsExecSQL(
        span,
        `UPDATE dashboards SET name = ?, levels = ?, date_modified = ?
         WHERE id = ?`,
        [
          name,
          JSON.stringify(levels || []),
          new Date().toISOString(),
          id,
        ] as never[],
      );
      return changed > 0;
    } finally {
      span.end();
    }
  }

  public static async delete(context: Span, id: string): Promise<boolean> {
    const span = OTelTracer().startSpan("DashboardsRepository_delete", context);
    try {
      const changed = SqlDbUtilsExecSQL(
        span,
        "DELETE FROM dashboards WHERE id = ?",
        [id] as never[],
      );
      return changed > 0;
    } finally {
      span.end();
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static fromRaw(raw: any): Dashboard {
    const d = new Dashboard();
    d.id = raw.id;
    d.name = raw.name;
    try {
      d.levels = JSON.parse(raw.levels || "[]");
      if (!Array.isArray(d.levels)) {
        d.levels = [];
      }
    } catch {
      d.levels = [];
    }
    d.dateCreated = new Date(raw.date_created);
    d.dateModified = new Date(raw.date_modified);
    return d;
  }
}
