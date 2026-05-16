import * as fse from "fs-extra";
import * as path from "path";
import { Span } from "@opentelemetry/sdk-trace-base";
import { Config } from "../Config";
import { OTelLogger, OTelTracer } from "../OTelContext";
import { Report } from "./models/Report";
import { ReportVersion } from "./models/ReportVersion";
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

const logger = OTelLogger().createModuleLogger("ReportsService");

export interface IngestInput {
  /** Stable name (the unique key) of the logical Report. */
  key: string;
  /** Optional human display name (only applied if Report does not yet exist or is empty). */
  displayName?: string | null;
  processor: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        throw new HttpError(404, `Processor not found: ${input.processor}`);
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
          version.hasFile = false;
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
            dateCreated: version.dateCreated.toISOString(),
          },
          { spaces: 2 },
        );

        await moveTmpToFinal(version.id);
        await ReportsRepository.addVersion(span, version);
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

export class HttpError extends Error {
  public readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function validateInput(input: IngestInput): void {
  if (!input.key || typeof input.key !== "string") {
    throw new HttpError(400, "Field required: key");
  }
  if (!/^[a-zA-Z0-9._:\-/]{1,200}$/.test(input.key)) {
    throw new HttpError(
      400,
      "Field 'key' must be 1..200 chars and contain only [a-zA-Z0-9._:-/]",
    );
  }
  if (!input.processor || typeof input.processor !== "string") {
    throw new HttpError(400, "Field required: processor");
  }
}
