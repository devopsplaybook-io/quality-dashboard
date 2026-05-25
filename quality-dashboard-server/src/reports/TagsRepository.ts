import { Span } from "@opentelemetry/sdk-trace-base";
import { OTelTracer } from "../OTelContext";
import {
  SqlDbUtilsExecSQL,
  SqlDbUtilsQuerySQL,
} from "../utils-std-ts/SqlDbUtils";
import { ReportTag } from "./models/ReportTag";

/**
 * Persistence for tags attached to Report keys.
 * Tags apply to all versions of a Report (past and future).
 * Model: one value per (reportKey, tag).
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class TagsRepository {
  //
  public static async setTag(
    context: Span,
    reportKey: string,
    tag: string,
    value: string,
  ): Promise<void> {
    const span = OTelTracer().startSpan("TagsRepository_setTag", context);
    try {
      SqlDbUtilsExecSQL(
        span,
        `INSERT INTO report_tags (report_key, tag, value)
         VALUES (?, ?, ?)
         ON CONFLICT(report_key, tag) DO UPDATE SET value = excluded.value`,
        [reportKey, tag, value] as never[],
      );
    } finally {
      span.end();
    }
  }

  public static async removeTag(
    context: Span,
    reportKey: string,
    tag: string,
  ): Promise<boolean> {
    const span = OTelTracer().startSpan("TagsRepository_removeTag", context);
    try {
      const changed = SqlDbUtilsExecSQL(
        span,
        "DELETE FROM report_tags WHERE report_key = ? AND tag = ?",
        [reportKey, tag] as never[],
      );
      return changed > 0;
    } finally {
      span.end();
    }
  }

  public static async listTagsForReport(
    context: Span,
    reportKey: string,
  ): Promise<ReportTag[]> {
    const span = OTelTracer().startSpan(
      "TagsRepository_listTagsForReport",
      context,
    );
    try {
      const rows = SqlDbUtilsQuerySQL(
        span,
        "SELECT * FROM report_tags WHERE report_key = ? ORDER BY tag ASC",
        [reportKey] as never[],
      );
      return rows.map((r) => ({
        reportKey: r.report_key,
        tag: r.tag,
        value: r.value,
      }));
    } finally {
      span.end();
    }
  }

  public static async listAllTags(context: Span): Promise<ReportTag[]> {
    const span = OTelTracer().startSpan("TagsRepository_listAllTags", context);
    try {
      const rows = SqlDbUtilsQuerySQL(
        span,
        "SELECT * FROM report_tags ORDER BY tag ASC, value ASC",
      );
      return rows.map((r) => ({
        reportKey: r.report_key,
        tag: r.tag,
        value: r.value,
      }));
    } finally {
      span.end();
    }
  }

  public static async listDistinctTagNames(context: Span): Promise<string[]> {
    const span = OTelTracer().startSpan(
      "TagsRepository_listDistinctTagNames",
      context,
    );
    try {
      const rows = SqlDbUtilsQuerySQL(
        span,
        "SELECT DISTINCT tag FROM report_tags ORDER BY tag ASC",
      );
      return rows.map((r) => r.tag as string);
    } finally {
      span.end();
    }
  }

  public static async listValuesForTag(
    context: Span,
    tag: string,
  ): Promise<string[]> {
    const span = OTelTracer().startSpan(
      "TagsRepository_listValuesForTag",
      context,
    );
    try {
      const rows = SqlDbUtilsQuerySQL(
        span,
        "SELECT DISTINCT value FROM report_tags WHERE tag = ? ORDER BY value ASC",
        [tag] as never[],
      );
      return rows.map((r) => r.value as string);
    } finally {
      span.end();
    }
  }

  /**
   * Replace all tags for a report key with the provided list.
   * Any tags not in the list are removed.
   */
  public static async replaceTagsForReport(
    context: Span,
    reportKey: string,
    tags: { tag: string; value: string }[],
  ): Promise<void> {
    const span = OTelTracer().startSpan(
      "TagsRepository_replaceTagsForReport",
      context,
    );
    try {
      SqlDbUtilsExecSQL(span, "DELETE FROM report_tags WHERE report_key = ?", [
        reportKey,
      ] as never[]);
      for (const t of tags) {
        if (!t.tag || !t.value) {
          continue;
        }
        SqlDbUtilsExecSQL(
          span,
          "INSERT INTO report_tags (report_key, tag, value) VALUES (?, ?, ?)",
          [reportKey, t.tag, t.value] as never[],
        );
      }
    } finally {
      span.end();
    }
  }

  /**
   * Find all report keys that have a given tag (and optionally value).
   */
  public static async findReportKeysByTag(
    context: Span,
    tag: string,
    value?: string,
  ): Promise<string[]> {
    const span = OTelTracer().startSpan(
      "TagsRepository_findReportKeysByTag",
      context,
    );
    try {
      const rows = value
        ? SqlDbUtilsQuerySQL(
            span,
            "SELECT report_key FROM report_tags WHERE tag = ? AND value = ?",
            [tag, value] as never[],
          )
        : SqlDbUtilsQuerySQL(
            span,
            "SELECT report_key FROM report_tags WHERE tag = ?",
            [tag] as never[],
          );
      return rows.map((r) => r.report_key as string);
    } finally {
      span.end();
    }
  }

  /**
   * Return a map of reportKey -> ReportTag[] for the given keys.
   */
  public static async listTagsForReports(
    context: Span,
    reportKeys: string[],
  ): Promise<Map<string, ReportTag[]>> {
    const span = OTelTracer().startSpan(
      "TagsRepository_listTagsForReports",
      context,
    );
    try {
      const result = new Map<string, ReportTag[]>();
      if (reportKeys.length === 0) {
        return result;
      }
      const placeholders = reportKeys.map(() => "?").join(",");
      const rows = SqlDbUtilsQuerySQL(
        span,
        `SELECT * FROM report_tags WHERE report_key IN (${placeholders})
         ORDER BY tag ASC`,
        reportKeys as never[],
      );
      for (const r of rows) {
        const list = result.get(r.report_key) || [];
        list.push({ reportKey: r.report_key, tag: r.tag, value: r.value });
        result.set(r.report_key, list);
      }
      return result;
    } finally {
      span.end();
    }
  }
}
