import * as fse from "fs-extra";
import * as path from "path";
import { Span } from "@opentelemetry/sdk-trace-base";
import { Config } from "../Config";
import { OTelLogger, OTelTracer } from "../OTelContext";
import { Report } from "./models/Report";
import { ReportVersion } from "./models/ReportVersion";
import { HttpError } from "./HttpError";
import { ReportsRepository } from "./ReportsRepository";
import {
  ensureReportTmpDir,
  extractArchive,
  getReportTmpDir,
  isArchive,
  moveTmpToFinal,
  removeReport,
} from "./FileStorage";
import {
  hasProcessor,
  runProcessor,
  ProcessorResult,
} from "./ProcessorRegistry";
import { GateEvaluator } from "./GateEvaluator";
import { WebhookNotifier } from "./WebhookNotifier";
import { SettingsDB } from "../settings/SettingsDB";

const logger = OTelLogger().createModuleLogger("ReportsService");

export interface IngestInput {
  /** Stable name (the unique key) of the logical Report. */
  key: string;
  /** Optional human display name (only applied if Report does not yet exist or is empty). */
  displayName?: string | null;
  processor: string;
  jsonPayload?: any;
  file?: {
    filename: string;
    buffer: Buffer;
  };
}

export interface IngestResult {
  report: Report;
  version: ReportVersion;
}

export { HttpError } from "./HttpError";

export class ReportsService {
  //
  /**
   * Ingest one upload:
   *  - Upserts the Report (by key)
   *  - Creates a new ReportVersion
   *  - Stores file content under the version's id
   */
  public static async ingest(
    context: Span,
    config: Config,
    input: IngestInput,
  ): Promise<IngestResult> {
    const span = OTelTracer().startSpan("ReportsService_ingest", context);
    try {
      validateInput(input);
      if (!hasProcessor(input.processor)) {
        throw new HttpError(404, `Processor not found: ${input.processor}`, {
          processor: input.processor,
          field: "processor",
          expected: "one of the processors listed by GET /api/reports/processors",
        });
      }

      const report = await ReportsRepository.upsertReport(
        span,
        input.key,
        input.displayName ?? null,
      );

      const version = new ReportVersion();
      version.reportKey = report.key;
      version.processor = input.processor;

      const tmpDir = await ensureReportTmpDir(version.id);
      const reportContentDir = path.join(tmpDir, "report");

      try {
        // 1) Persist input file (if any) into the version content dir
        if (input.file && input.file.buffer.length > 0) {
          if (isArchive(input.file.filename)) {
            const archivePath = path.join(tmpDir, input.file.filename);
            await fse.writeFile(archivePath, input.file.buffer);
            await extractArchive(
              archivePath,
              reportContentDir,
              input.file.filename,
            );
            await fse.remove(archivePath);
          } else {
            await fse.writeFile(
              path.join(reportContentDir, input.file.filename),
              input.file.buffer,
            );
          }
          version.hasFile = true;
        } else if (input.jsonPayload) {
          await fse.writeJson(
            path.join(reportContentDir, "data.json"),
            input.jsonPayload,
          );
          version.hasFile = true;
          version.fileEntrypoint = "data.json";
        }

        // 2) Run processor
        const timeoutMs = config.PROCESSOR_TIMEOUT_MS;
        const result: ProcessorResult = await runProcessor(
          version.processor,
          { reportDir: reportContentDir, jsonPayload: input.jsonPayload },
          timeoutMs,
        );

        version.metrics = result.metrics;
        version.info = result.info || {};
        if (result.fileEntrypoint && version.hasFile) {
          version.fileEntrypoint = result.fileEntrypoint;
        }

        // 2b) Evaluate quality gate rules for this report
        const rules = await ReportsRepository.listGatesForReport(
          span,
          report.key,
        );
        const gate = GateEvaluator.evaluate(rules, version.metrics);
        version.gateStatus = gate.status;
        version.gateResults = gate.results;

        // 3) Persist meta.json next to content (in tmp), then move to final
        await fse.writeJson(
          path.join(tmpDir, "meta.json"),
          {
            id: version.id,
            reportKey: version.reportKey,
            processor: version.processor,
            metrics: version.metrics,
            info: version.info,
            fileEntrypoint: version.fileEntrypoint,
            hasFile: version.hasFile,
            gateStatus: version.gateStatus,
            gateResults: version.gateResults,
            dateCreated: version.dateCreated.toISOString(),
          },
          { spaces: 2 },
        );

        await moveTmpToFinal(version.id);
        await ReportsRepository.addVersion(span, version);
        if (version.gateStatus === "fail") {
          const settings = await SettingsDB.get(span);
          await WebhookNotifier.notifyGateFailure(span, settings.webhookUrl, {
            event: "quality.gate.failed",
            report: { key: report.key, displayName: report.displayName },
            version: {
              id: version.id,
              processor: version.processor,
              dateCreated: version.dateCreated.toISOString(),
            },
            gate: { status: version.gateStatus, results: version.gateResults },
            metrics: version.metrics,
          });
        }
        return { report, version };
      } catch (err) {
        // Cleanup tmp on failure
        try {
          await fse.remove(getReportTmpDir(version.id));
        } catch (cleanupErr) {
          logger.error(`Failed to cleanup tmp dir: ${cleanupErr}`);
        }
        throw err;
      }
    } finally {
      span.end();
    }
  }

  public static async deleteReport(
    context: Span,
    key: string,
  ): Promise<boolean> {
    const span = OTelTracer().startSpan("ReportsService_deleteReport", context);
    try {
      const existing = await ReportsRepository.getReport(span, key);
      if (!existing) {
        return false;
      }
      const versionIds = await ReportsRepository.deleteReport(span, key);
      for (const id of versionIds) {
        await removeReport(id);
      }
      return true;
    } finally {
      span.end();
    }
  }

  public static async deleteVersion(
    context: Span,
    versionId: string,
  ): Promise<boolean> {
    const span = OTelTracer().startSpan(
      "ReportsService_deleteVersion",
      context,
    );
    try {
      const existing = await ReportsRepository.getVersion(span, versionId);
      if (!existing) {
        return false;
      }
      await ReportsRepository.deleteVersion(span, versionId);
      await removeReport(versionId);
      return true;
    } finally {
      span.end();
    }
  }

  public static async deleteAll(context: Span): Promise<void> {
    const span = OTelTracer().startSpan("ReportsService_deleteAll", context);
    try {
      const ids = await ReportsRepository.deleteAll(span);
      for (const id of ids) {
        await removeReport(id);
      }
    } finally {
      span.end();
    }
  }
}

const KEY_HINT =
  'Pass key in the \'meta\' JSON field, e.g. {"key":"my-team/my-app/unit-tests"}';

function validateInput(input: IngestInput): void {
  if (!input.key || typeof input.key !== "string") {
    throw new HttpError(400, "Field required: key", {
      field: "key",
      expected: "non-empty string (unique report key)",
      hint: KEY_HINT,
    });
  }
  if (!/^[a-zA-Z0-9._:\-/]{1,200}$/.test(input.key)) {
    throw new HttpError(
      400,
      "Field 'key' must be 1..200 chars and contain only [a-zA-Z0-9._:-/]",
      {
        field: "key",
        expected: "1..200 chars matching ^[a-zA-Z0-9._:\\-/]+$",
        hint: KEY_HINT,
      },
    );
  }
  if (!input.processor || typeof input.processor !== "string") {
    throw new HttpError(400, "Field required: processor", {
      field: "processor",
      expected: "name of a registered processor (GET /api/reports/processors)",
    });
  }
}
