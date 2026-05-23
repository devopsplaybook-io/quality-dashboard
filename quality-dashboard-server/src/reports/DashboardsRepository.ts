import { Span } from "@opentelemetry/sdk-trace-base";
import { OTelTracer } from "../OTelContext";
import {
  SqlDbUtilsExecSQL,
  SqlDbUtilsQuerySQL,
} from "../utils-std-ts/SqlDbUtils";
import {
  DASHBOARD_SCHEMA_VERSION,
  Dashboard,
  DashboardLevelNode,
} from "./models/Dashboard";

/**
 * Persistence for user-defined Dashboards.
 * The whole tree of levels is stored as JSON in the `definition` column.
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class DashboardsRepository {
  //
  public static async add(context: Span, dashboard: Dashboard): Promise<void> {
    const span = OTelTracer().startSpan("DashboardsRepository_add", context);
    try {
      SqlDbUtilsExecSQL(
        span,
        `INSERT INTO dashboards (id, name, definition, date_created, date_modified)
         VALUES (?, ?, ?, ?, ?)`,
        [
          dashboard.id,
          dashboard.name,
          JSON.stringify({
            schemaVersion: DASHBOARD_SCHEMA_VERSION,
            root: dashboard.root || [],
            shownMetrics: dashboard.shownMetrics,
          }),
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
    root: DashboardLevelNode[],
    shownMetrics?: string[],
  ): Promise<boolean> {
    const span = OTelTracer().startSpan("DashboardsRepository_update", context);
    try {
      const changed = SqlDbUtilsExecSQL(
        span,
        `UPDATE dashboards SET name = ?, definition = ?, date_modified = ?
         WHERE id = ?`,
        [
          name,
          JSON.stringify({
            schemaVersion: DASHBOARD_SCHEMA_VERSION,
            root: root || [],
            shownMetrics,
          }),
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
    let parsed: { schemaVersion?: number; root?: DashboardLevelNode[]; shownMetrics?: string[] };
    try {
      parsed = JSON.parse(raw.definition || "{}");
    } catch {
      parsed = {};
    }
    d.schemaVersion =
      typeof parsed.schemaVersion === "number"
        ? parsed.schemaVersion
        : DASHBOARD_SCHEMA_VERSION;
    d.root = Array.isArray(parsed.root) ? parsed.root : [];
    d.shownMetrics = Array.isArray(parsed.shownMetrics) ? parsed.shownMetrics : undefined;
    d.dateCreated = new Date(raw.date_created);
    d.dateModified = new Date(raw.date_modified);
    return d;
  }
}
