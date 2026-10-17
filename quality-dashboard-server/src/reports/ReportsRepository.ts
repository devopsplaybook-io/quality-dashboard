import { v4 as uuidv4 } from "uuid";
import { Span } from "@opentelemetry/sdk-trace-base";
import { OTelTracer } from "../OTelContext";
import {
  SqlDbUtilsExecSQL,
  SqlDbUtilsQuerySQL,
} from "../utils-std-ts/SqlDbUtils";
import { Report } from "./models/Report";
import { ReportVersion } from "./models/ReportVersion";
import { Metric } from "./models/Metric";
import { MetricType } from "./models/MetricType";
import { GateResult, GateRule, GateStatus } from "./models/GateRule";

/**
 * Persistence for Reports (named entities) and their ReportVersions.
 * Each Report has many ReportVersions; each ReportVersion has many Metrics.
 */
export class ReportsRepository {
  //
  // ---- Report ----------------------------------------------------------

  public static async upsertReport(
    context: Span,
    key: string,
    displayName?: string | null,
  ): Promise<Report> {
    const span = OTelTracer().startSpan(
      "ReportsRepository_upsertReport",
      context,
    );
    try {
      const existing = SqlDbUtilsQuerySQL(
        span,
        "SELECT * FROM reports WHERE key = ?",
        [key] as never[],
      );
      const now = new Date();
      if (existing.length === 0) {
        SqlDbUtilsExecSQL(
          span,
          "INSERT INTO reports (key, display_name, date_created) VALUES (?, ?, ?)",
          [key, displayName || null, now.toISOString()] as never[],
        );
        const report = new Report();
        report.key = key;
        report.displayName = displayName || null;
        report.dateCreated = now;
        return report;
      }
      // Optionally refresh displayName if a non-empty one is provided
      if (typeof displayName === "string" && displayName.trim().length > 0) {
        SqlDbUtilsExecSQL(
          span,
          "UPDATE reports SET display_name = ? WHERE key = ?",
          [displayName, key] as never[],
        );
      }
      return ReportsRepository.reportFromRaw(existing[0]);
    } finally {
      span.end();
    }
  }

  public static async getReport(
    context: Span,
    key: string,
  ): Promise<Report | null> {
    const span = OTelTracer().startSpan("ReportsRepository_getReport", context);
    try {
      const rows = SqlDbUtilsQuerySQL(
        span,
        "SELECT * FROM reports WHERE key = ?",
        [key] as never[],
      );
      return rows.length === 0
        ? null
        : ReportsRepository.reportFromRaw(rows[0]);
    } finally {
      span.end();
    }
  }

  public static async updateDisplayName(
    context: Span,
    key: string,
    displayName: string | null,
  ): Promise<boolean> {
    const span = OTelTracer().startSpan(
      "ReportsRepository_updateDisplayName",
      context,
    );
    try {
      const changed = SqlDbUtilsExecSQL(
        span,
        "UPDATE reports SET display_name = ? WHERE key = ?",
        [displayName, key] as never[],
      );
      return changed > 0;
    } finally {
      span.end();
    }
  }

  public static async listReports(context: Span): Promise<Report[]> {
    const span = OTelTracer().startSpan(
      "ReportsRepository_listReports",
      context,
    );
    try {
      const rows = SqlDbUtilsQuerySQL(
        span,
        `SELECT r.*, MAX(rv.date_created) AS latest_version_date
         FROM reports r
         LEFT JOIN report_versions rv ON rv.report_key = r.key
         GROUP BY r.key
         ORDER BY latest_version_date DESC`,
      );
      return rows.map((r) => ReportsRepository.reportFromRaw(r));
    } finally {
      span.end();
    }
  }

  public static async deleteReport(
    context: Span,
    key: string,
  ): Promise<string[]> {
    const span = OTelTracer().startSpan(
      "ReportsRepository_deleteReport",
      context,
    );
    try {
      const versionRows = SqlDbUtilsQuerySQL(
        span,
        "SELECT id FROM report_versions WHERE report_key = ?",
        [key] as never[],
      );
      const versionIds = versionRows.map((v) => v.id as string);
      // Foreign keys with ON DELETE CASCADE handle the rest.
      SqlDbUtilsExecSQL(span, "DELETE FROM reports WHERE key = ?", [
        key,
      ] as never[]);
      // Defensive cleanup if FKs aren't enabled
      SqlDbUtilsExecSQL(span, "DELETE FROM report_tags WHERE report_key = ?", [
        key,
      ] as never[]);
      SqlDbUtilsExecSQL(span, "DELETE FROM report_gates WHERE report_key = ?", [
        key,
      ] as never[]);
      if (versionIds.length > 0) {
        const placeholders = versionIds.map(() => "?").join(",");
        SqlDbUtilsExecSQL(
          span,
          `DELETE FROM report_version_metrics WHERE report_version_id IN (${placeholders})`,
          versionIds as never[],
        );
        SqlDbUtilsExecSQL(
          span,
          `DELETE FROM report_versions WHERE id IN (${placeholders})`,
          versionIds as never[],
        );
      }
      return versionIds;
    } finally {
      span.end();
    }
  }

  public static async deleteAll(context: Span): Promise<string[]> {
    const span = OTelTracer().startSpan("ReportsRepository_deleteAll", context);
    try {
      const rows = SqlDbUtilsQuerySQL(span, "SELECT id FROM report_versions");
      const ids = rows.map((r) => r.id as string);
      SqlDbUtilsExecSQL(span, "DELETE FROM report_version_metrics");
      SqlDbUtilsExecSQL(span, "DELETE FROM report_versions");
      SqlDbUtilsExecSQL(span, "DELETE FROM report_tags");
      SqlDbUtilsExecSQL(span, "DELETE FROM report_gates");
      SqlDbUtilsExecSQL(span, "DELETE FROM reports");
      return ids;
    } finally {
      span.end();
    }
  }

  // ---- ReportVersion ---------------------------------------------------

  public static async addVersion(
    context: Span,
    version: ReportVersion,
  ): Promise<void> {
    const span = OTelTracer().startSpan(
      "ReportsRepository_addVersion",
      context,
    );
    try {
      SqlDbUtilsExecSQL(
        span,
        `INSERT INTO report_versions
         (id, report_key, processor, file_entrypoint, has_file, info, date_created, gate_status, gate_results)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          version.id,
          version.reportKey,
          version.processor,
          version.fileEntrypoint || null,
          version.hasFile ? 1 : 0,
          JSON.stringify(version.info || {}),
          version.dateCreated.toISOString(),
          version.gateStatus || null,
          JSON.stringify(version.gateResults || []),
        ] as never[],
      );
      let order = 0;
      for (const metric of version.metrics) {
        SqlDbUtilsExecSQL(
          span,
          `INSERT INTO report_version_metrics
           (id, report_version_id, name, type, value, display_order)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            version.id,
            metric.name,
            metric.type,
            metric.value,
            order++,
          ] as never[],
        );
      }
    } finally {
      span.end();
    }
  }

  public static async listVersions(
    context: Span,
    reportKey: string,
  ): Promise<ReportVersion[]> {
    const span = OTelTracer().startSpan(
      "ReportsRepository_listVersions",
      context,
    );
    try {
      const rows = SqlDbUtilsQuerySQL(
        span,
        "SELECT * FROM report_versions WHERE report_key = ? ORDER BY date_created DESC",
        [reportKey] as never[],
      );
      return ReportsRepository.attachMetrics(span, rows);
    } finally {
      span.end();
    }
  }

  public static async listRecentVersions(
    context: Span,
    limit: number,
    since?: string,
  ): Promise<ReportVersion[]> {
    const span = OTelTracer().startSpan(
      "ReportsRepository_listRecentVersions",
      context,
    );
    try {
      const rows = since
        ? SqlDbUtilsQuerySQL(
            span,
            "SELECT * FROM report_versions WHERE date_created > ? ORDER BY date_created DESC LIMIT ?",
            [since, limit] as never[],
          )
        : SqlDbUtilsQuerySQL(
            span,
            "SELECT * FROM report_versions ORDER BY date_created DESC LIMIT ?",
            [limit] as never[],
          );
      return ReportsRepository.attachMetrics(span, rows);
    } finally {
      span.end();
    }
  }

  public static async listLatestVersionsPerReport(
    context: Span,
  ): Promise<ReportVersion[]> {
    const span = OTelTracer().startSpan(
      "ReportsRepository_listLatestVersionsPerReport",
      context,
    );
    try {
      const rows = SqlDbUtilsQuerySQL(
        span,
        `SELECT v.* FROM report_versions v
         WHERE v.id IN (
            SELECT v2.id FROM report_versions v2
            WHERE v2.report_key = v.report_key
            ORDER BY v2.date_created DESC
            LIMIT 1
         )
         ORDER BY v.date_created DESC`,
      );
      return ReportsRepository.attachMetrics(span, rows);
    } finally {
      span.end();
    }
  }

  public static async listHistoryPerReport(
    context: Span,
    limit: number,
  ): Promise<ReportVersion[]> {
    const span = OTelTracer().startSpan(
      "ReportsRepository_listHistoryPerReport",
      context,
    );
    try {
      const rows = SqlDbUtilsQuerySQL(
        span,
        `SELECT * FROM (
           SELECT v.*, ROW_NUMBER() OVER (PARTITION BY v.report_key ORDER BY v.date_created DESC) AS rn
           FROM report_versions v
         ) WHERE rn <= ? ORDER BY report_key, date_created DESC`,
        [limit] as never[],
      );
      return ReportsRepository.attachMetrics(span, rows);
    } finally {
      span.end();
    }
  }

  public static async getVersion(
    context: Span,
    versionId: string,
  ): Promise<ReportVersion | null> {
    const span = OTelTracer().startSpan(
      "ReportsRepository_getVersion",
      context,
    );
    try {
      const rows = SqlDbUtilsQuerySQL(
        span,
        "SELECT * FROM report_versions WHERE id = ?",
        [versionId] as never[],
      );
      if (rows.length === 0) {
        return null;
      }
      const list = await ReportsRepository.attachMetrics(span, rows);
      return list[0] || null;
    } finally {
      span.end();
    }
  }

  public static async deleteVersion(
    context: Span,
    versionId: string,
  ): Promise<boolean> {
    const span = OTelTracer().startSpan(
      "ReportsRepository_deleteVersion",
      context,
    );
    try {
      SqlDbUtilsExecSQL(
        span,
        "DELETE FROM report_version_metrics WHERE report_version_id = ?",
        [versionId] as never[],
      );
      const changed = SqlDbUtilsExecSQL(
        span,
        "DELETE FROM report_versions WHERE id = ?",
        [versionId] as never[],
      );
      return changed > 0;
    } finally {
      span.end();
    }
  }

  // ---- ReportGates -----------------------------------------------------

  public static async listGatesForReport(
    context: Span,
    reportKey: string,
  ): Promise<GateRule[]> {
    const span = OTelTracer().startSpan(
      "ReportsRepository_listGatesForReport",
      context,
    );
    try {
      const rows = SqlDbUtilsQuerySQL(
        span,
        "SELECT * FROM report_gates WHERE report_key = ? ORDER BY date_created ASC",
        [reportKey] as never[],
      );
      return rows.map((r) => ReportsRepository.gateFromRaw(r));
    } finally {
      span.end();
    }
  }

  /**
   * Replace all gate rules of a report with the provided list.
   * Gate data is derived (status + per-version results), so callers re-evaluate
   * versions after replacing rules.
   */
  public static async replaceGatesForReport(
    context: Span,
    reportKey: string,
    rules: { metric: string; operator: string; warnValue?: number | null; failValue: number }[],
  ): Promise<GateRule[]> {
    const span = OTelTracer().startSpan(
      "ReportsRepository_replaceGatesForReport",
      context,
    );
    try {
      SqlDbUtilsExecSQL(span, "DELETE FROM report_gates WHERE report_key = ?", [
        reportKey,
      ] as never[]);
      const now = new Date().toISOString();
      const stored: GateRule[] = [];
      for (const rule of rules) {
        const id = uuidv4();
        SqlDbUtilsExecSQL(
          span,
          `INSERT INTO report_gates
           (id, report_key, metric, operator, warn_value, fail_value, date_created)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            reportKey,
            rule.metric,
            rule.operator,
            rule.warnValue == null ? null : rule.warnValue,
            rule.failValue,
            now,
          ] as never[],
        );
        stored.push({
          id,
          metric: rule.metric,
          operator: rule.operator as GateRule["operator"],
          warnValue: rule.warnValue == null ? undefined : rule.warnValue,
          failValue: rule.failValue,
          dateCreated: new Date(now),
        });
      }
      return stored;
    } finally {
      span.end();
    }
  }

  public static async updateVersionGate(
    context: Span,
    versionId: string,
    status: GateStatus | null,
    results: GateResult[],
  ): Promise<void> {
    const span = OTelTracer().startSpan(
      "ReportsRepository_updateVersionGate",
      context,
    );
    try {
      SqlDbUtilsExecSQL(
        span,
        "UPDATE report_versions SET gate_status = ?, gate_results = ? WHERE id = ?",
        [status, JSON.stringify(results || []), versionId] as never[],
      );
    } finally {
      span.end();
    }
  }

  // ---- helpers ---------------------------------------------------------

  private static async attachMetrics(
    span: Span,
    rows: any[],
  ): Promise<ReportVersion[]> {
    if (rows.length === 0) {
      return [];
    }
    const ids = rows.map((r) => r.id);
    const placeholders = ids.map(() => "?").join(",");
    const metricRows = SqlDbUtilsQuerySQL(
      span,
      `SELECT * FROM report_version_metrics
       WHERE report_version_id IN (${placeholders})
       ORDER BY display_order ASC`,
      ids as never[],
    );
    const byVersion = new Map<string, Metric[]>();
    for (const m of metricRows) {
      if (!byVersion.has(m.report_version_id)) {
        byVersion.set(m.report_version_id, []);
      }
      const list = byVersion.get(m.report_version_id) || [];
      list.push({
        name: m.name,
        type: m.type as MetricType,
        value: Number(m.value),
      });
    }
    return rows.map((r) =>
      ReportsRepository.versionFromRaw(r, byVersion.get(r.id) || []),
    );
  }

  private static reportFromRaw(raw: any): Report {
    const report = new Report();
    report.key = raw.key;
    report.displayName = raw.display_name || null;
    report.dateCreated = new Date(raw.date_created);
    return report;
  }

  private static versionFromRaw(raw: any, metrics: Metric[]): ReportVersion {
    const v = new ReportVersion();
    v.id = raw.id;
    v.reportKey = raw.report_key;
    v.processor = raw.processor;
    v.fileEntrypoint = raw.file_entrypoint || undefined;
    v.hasFile = !!raw.has_file;
    try {
      v.info = JSON.parse(raw.info || "{}");
    } catch {
      v.info = {};
    }
    v.gateStatus = raw.gate_status || null;
    try {
      v.gateResults = JSON.parse(raw.gate_results || "[]");
    } catch {
      v.gateResults = [];
    }
    v.dateCreated = new Date(raw.date_created);
    v.metrics = metrics;
    return v;
  }

  private static gateFromRaw(raw: any): GateRule {
    return {
      id: raw.id,
      metric: raw.metric,
      operator: raw.operator,
      warnValue: raw.warn_value == null ? undefined : Number(raw.warn_value),
      failValue: Number(raw.fail_value),
      dateCreated: new Date(raw.date_created),
    };
  }
}
