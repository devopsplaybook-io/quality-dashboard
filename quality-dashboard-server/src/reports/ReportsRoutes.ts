import * as fse from "fs-extra";
import * as path from "path";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Auth } from "../users/Auth";
import { Config } from "../Config";
import { OTelLogger, OTelRequestSpan } from "../OTelContext";
import { ReportsRepository } from "./ReportsRepository";
import { TagsRepository } from "./TagsRepository";
import { HttpError, ReportsService } from "./ReportsService";
import {
  hasFormatReportPreview,
  listProcessors,
  runFormatReportPreview,
} from "./ProcessorRegistry";
import { getReportContentDir, resolveSafeReportFile } from "./FileStorage";
import { SettingsDB } from "../settings/SettingsDB";
import { Report } from "./models/Report";
import { ReportVersion } from "./models/ReportVersion";

const logger = OTelLogger().createModuleLogger("ReportsRoutes");
let config: Config;

const RECENT_DEFAULT_LIMIT = 100;
const RECENT_MAX_LIMIT = 500;

export function ReportsRoutesInit(_context: unknown, configIn: Config): void {
  config = configIn;
}

const TEXT_EXT_TO_MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".yaml": "text/yaml; charset=utf-8",
  ".yml": "text/yaml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

export class ReportsRoutes {
  //
  public async getRoutes(fastify: FastifyInstance): Promise<void> {
    //
    fastify.get("/processors", async (req, res) => {
      return res.status(200).send({ processors: listProcessors() });
    });

    // ---- Recent versions (chronological feed) -----------------------------
    fastify.get("/recent", async (req, res) => {
      if (!(await ensureCanRead(req, res))) {
        return;
      }
      const q = req.query as { limit?: string; since?: string };
      let limit = Number(q.limit || RECENT_DEFAULT_LIMIT);
      if (!Number.isFinite(limit) || limit <= 0) {
        limit = RECENT_DEFAULT_LIMIT;
      }
      if (limit > RECENT_MAX_LIMIT) {
        limit = RECENT_MAX_LIMIT;
      }
      const span = OTelRequestSpan(req);
      const versions = await ReportsRepository.listRecentVersions(
        span,
        limit,
        q.since,
      );
      const reports = await ReportsRepository.listReports(span);
      const reportsByKey = new Map(reports.map((r) => [r.key, r]));
      const tagsByKey = await TagsRepository.listTagsForReports(
        span,
        Array.from(new Set(versions.map((v) => v.reportKey))),
      );
      return res.status(200).send({
        versions: versions.map((v) =>
          toApiVersion(v, reportsByKey.get(v.reportKey) || null, tagsByKey),
        ),
      });
    });

    // ---- Reports list -----------------------------------------------------
    fastify.get("/", async (req, res) => {
      if (!(await ensureCanRead(req, res))) {
        return;
      }
      const span = OTelRequestSpan(req);
      const reports = await ReportsRepository.listReports(span);
      const tagsByKey = await TagsRepository.listTagsForReports(
        span,
        reports.map((r) => r.key),
      );
      const latestVersions =
        await ReportsRepository.listLatestVersionsPerReport(span);
      const latestByKey = new Map(latestVersions.map((v) => [v.reportKey, v]));
      return res.status(200).send({
        reports: reports.map((r) =>
          toApiReport(
            r,
            tagsByKey.get(r.key) || [],
            latestByKey.get(r.key) || null,
          ),
        ),
      });
    });

    // ---- Single report ----------------------------------------------------
    fastify.get<{ Params: { key: string } }>("/:key", async (req, res) => {
      if (!(await ensureCanRead(req, res))) {
        return;
      }
      const span = OTelRequestSpan(req);
      const report = await ReportsRepository.getReport(span, req.params.key);
      if (!report) {
        return res.status(404).send({ error: "Report not found" });
      }
      const tags = await TagsRepository.listTagsForReport(span, report.key);
      return res.status(200).send({ report: toApiReport(report, tags) });
    });

    // ---- Update displayName ----------------------------------------------
    fastify.put<{
      Params: { key: string };
      Body: { displayName?: string | null };
    }>("/:key", async (req, res) => {
      if (!(await ensureAuthenticated(req, res))) {
        return;
      }
      const span = OTelRequestSpan(req);
      const ok = await ReportsRepository.updateDisplayName(
        span,
        req.params.key,
        typeof req.body?.displayName === "string" ? req.body.displayName : null,
      );
      if (!ok) {
        return res.status(404).send({ error: "Report not found" });
      }
      return res.status(200).send({});
    });

    // ---- Delete a report (and all its versions) ---------------------------
    fastify.delete<{ Params: { key: string } }>("/:key", async (req, res) => {
      if (!(await ensureAuthenticated(req, res))) {
        return;
      }
      const ok = await ReportsService.deleteReport(
        OTelRequestSpan(req),
        req.params.key,
      );
      if (!ok) {
        return res.status(404).send({ error: "Report not found" });
      }
      return res.status(200).send({});
    });

    // ---- List versions for a report ---------------------------------------
    fastify.get<{ Params: { key: string } }>(
      "/:key/versions",
      async (req, res) => {
        if (!(await ensureCanRead(req, res))) {
          return;
        }
        const span = OTelRequestSpan(req);
        const report = await ReportsRepository.getReport(span, req.params.key);
        if (!report) {
          return res.status(404).send({ error: "Report not found" });
        }
        const versions = await ReportsRepository.listVersions(span, report.key);
        const tags = await TagsRepository.listTagsForReport(span, report.key);
        return res.status(200).send({
          versions: versions.map((v) =>
            toApiVersion(v, report, new Map([[report.key, tags]])),
          ),
        });
      },
    );

    // ---- Get a single version --------------------------------------------
    fastify.get<{ Params: { key: string; versionId: string } }>(
      "/:key/versions/:versionId",
      async (req, res) => {
        if (!(await ensureCanRead(req, res))) {
          return;
        }
        const span = OTelRequestSpan(req);
        const version = await ReportsRepository.getVersion(
          span,
          req.params.versionId,
        );
        if (!version || version.reportKey !== req.params.key) {
          return res.status(404).send({ error: "Version not found" });
        }
        const report = await ReportsRepository.getReport(
          span,
          version.reportKey,
        );
        const tags = await TagsRepository.listTagsForReport(
          span,
          version.reportKey,
        );
        return res.status(200).send({
          version: toApiVersion(
            version,
            report,
            new Map([[version.reportKey, tags]]),
          ),
        });
      },
    );

    // ---- Delete a single version -----------------------------------------
    fastify.delete<{ Params: { key: string; versionId: string } }>(
      "/:key/versions/:versionId",
      async (req, res) => {
        if (!(await ensureAuthenticated(req, res))) {
          return;
        }
        const span = OTelRequestSpan(req);
        const version = await ReportsRepository.getVersion(
          span,
          req.params.versionId,
        );
        if (!version || version.reportKey !== req.params.key) {
          return res.status(404).send({ error: "Version not found" });
        }
        await ReportsService.deleteVersion(span, version.id);
        return res.status(200).send({});
      },
    );

    // ---- Serve files belonging to a version ------------------------------
    fastify.get<{
      Params: { key: string; versionId: string; "*": string };
      Querystring: { download?: string };
    }>("/:key/versions/:versionId/file/*", async (req, res) => {
      if (!(await ensureCanRead(req, res))) {
        return;
      }
      const span = OTelRequestSpan(req);
      const version = await ReportsRepository.getVersion(
        span,
        req.params.versionId,
      );
      if (!version || version.reportKey !== req.params.key) {
        return res.status(404).send({ error: "Version not found" });
      }
      if (!version.hasFile) {
        return res.status(404).send({ error: "Version has no file" });
      }
      const relative =
        (req.params as Record<string, string>)["*"] ||
        version.fileEntrypoint ||
        "";
      const safe = await resolveSafeReportFile(version.id, relative);
      if (!safe) {
        return res.status(404).send({ error: "File not found" });
      }
      const ext = path.extname(safe).toLowerCase();
      const mime = TEXT_EXT_TO_MIME[ext] || "application/octet-stream";
      const q = req.query as { download?: string };
      if (q.download === "1") {
        res.header(
          "Content-Disposition",
          `attachment; filename="${path.basename(relative)}"`,
        );
        res.header("Content-Type", "application/octet-stream");
      } else {
        res.header("Content-Disposition", "inline");
        res.header("Content-Type", mime);
      }
      return res.send(fse.createReadStream(safe));
    });

    // ---- Get preview HTML for a version ----------------------------------
    fastify.get<{
      Params: { key: string; versionId: string };
    }>("/:key/versions/:versionId/preview", async (req, res) => {
      if (!(await ensureCanRead(req, res))) {
        return;
      }
      const span = OTelRequestSpan(req);
      const version = await ReportsRepository.getVersion(
        span,
        req.params.versionId,
      );
      if (!version || version.reportKey !== req.params.key) {
        return res.status(404).send({ error: "Version not found" });
      }
      if (!hasFormatReportPreview(version.processor)) {
        return res
          .status(404)
          .send({ error: "Processor does not support preview" });
      }

      const reportDir = getReportContentDir(version.id);

      try {
        const html = await runFormatReportPreview(
          version.processor,
          {
            reportDir,
            fileEntrypoint: version.fileEntrypoint,
          },
          config.PROCESSOR_TIMEOUT_MS,
        );
        res.header("Content-Type", "text/html; charset=utf-8");
        return res.status(200).send(html);
      } catch (err) {
        logger.error(`Preview generation failed: ${(err as Error).message}`);
        return res
          .status(500)
          .send({ error: `Preview failed: ${(err as Error).message}` });
      }
    });

    // ---- Upload a new version --------------------------------------------
    fastify.post("/", async (req, res) => {
      try {
        if (!(await ensureCanWrite(req, res))) {
          return;
        }
        const ct = String(req.headers["content-type"] || "");
        if (!ct.startsWith("multipart/form-data")) {
          return res
            .status(400)
            .send({ error: "Request must be multipart/form-data" });
        }
        const parsed = await parseMultipart(req);
        const meta = parsed.meta;
        if (!meta || typeof meta !== "object") {
          return res
            .status(400)
            .send({ error: "Field required: 'meta' (JSON)" });
        }
        const span = OTelRequestSpan(req);
        const { report, version } = await ReportsService.ingest(span, config, {
          key: meta.key || meta.name,
          displayName: meta.displayName ?? null,
          processor: meta.processor,
          jsonPayload: meta.jsonPayload,
          file: parsed.file,
        });
        const tags = await TagsRepository.listTagsForReport(span, report.key);
        return res.status(201).send({
          version: toApiVersion(version, report, new Map([[report.key, tags]])),
          report: toApiReport(report, tags),
        });
      } catch (err) {
        if (err instanceof HttpError) {
          return res.status(err.status).send({ error: err.message });
        }
        logger.error(`Ingest failed: ${(err as Error).message}`);
        return res
          .status(500)
          .send({ error: `Ingest failed: ${(err as Error).message}` });
      }
    });

    // ---- Delete all reports ----------------------------------------------
    fastify.delete("/", async (req, res) => {
      if (!(await ensureAuthenticated(req, res))) {
        return;
      }
      await ReportsService.deleteAll(OTelRequestSpan(req));
      return res.status(200).send({});
    });
  }
}

function toApiReport(
  report: Report,
  tags: { tag: string; value: string }[],
  latestVersion: ReportVersion | null = null,
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    key: report.key,
    displayName: report.displayName,
    dateCreated: report.dateCreated.toISOString(),
    tags: tags.map(toApiTag),
  };
  if (latestVersion) {
    result.latestVersion = {
      id: latestVersion.id,
      processor: latestVersion.processor,
      metrics: latestVersion.metrics,
      hasFile: latestVersion.hasFile,
      fileEntrypoint: latestVersion.fileEntrypoint,
      hasPreview: hasFormatReportPreview(latestVersion.processor),
      dateCreated: latestVersion.dateCreated.toISOString(),
    };
  }
  return result;
}

function toApiTag(t: { tag: string; value: string }): {
  tag: string;
  value: string;
} {
  return { tag: t.tag, value: t.value };
}

function toApiVersion(
  v: ReportVersion,
  report: Report | null,
  tagsByKey: Map<string, { tag: string; value: string }[]>,
): Record<string, unknown> {
  return {
    id: v.id,
    reportKey: v.reportKey,
    reportDisplayName: report?.displayName || null,
    processor: v.processor,
    metrics: v.metrics,
    info: v.info,
    hasFile: v.hasFile,
    fileEntrypoint: v.fileEntrypoint,
    hasPreview: hasFormatReportPreview(v.processor),
    dateCreated: v.dateCreated.toISOString(),
    tags: (tagsByKey.get(v.reportKey) || []).map(toApiTag),
  };
}

async function ensureCanRead(
  req: FastifyRequest,
  res: FastifyReply,
): Promise<boolean> {
  const settings = await SettingsDB.get(OTelRequestSpan(req));
  if (settings.isDashboardPublic) {
    return true;
  }
  const userSession = await Auth.getUserSession(req);
  if (!userSession.isAuthenticated) {
    res.status(403).send({ error: "Access Denied" });
    return false;
  }
  return true;
}

async function ensureAuthenticated(
  req: FastifyRequest,
  res: FastifyReply,
): Promise<boolean> {
  const userSession = await Auth.getUserSession(req);
  if (!userSession.isAuthenticated) {
    res.status(403).send({ error: "Access Denied" });
    return false;
  }
  return true;
}

async function ensureCanWrite(
  req: FastifyRequest,
  res: FastifyReply,
): Promise<boolean> {
  const userSession = await Auth.getUserSession(req);
  if (userSession.isAuthenticated) {
    return true;
  }
  const settings = await SettingsDB.get(OTelRequestSpan(req));
  const headerToken = String(req.headers["x-upload-token"] || "").trim();
  if (
    settings.uploadToken &&
    headerToken &&
    headerToken === settings.uploadToken
  ) {
    return true;
  }
  res.status(403).send({ error: "Access Denied" });
  return false;
}

interface ParsedMultipart {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meta: any;
  file?: { filename: string; buffer: Buffer };
}

async function parseMultipart(req: FastifyRequest): Promise<ParsedMultipart> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reqAny = req as any;
  if (typeof reqAny.parts !== "function") {
    throw new HttpError(
      500,
      "Multipart parser not registered (requires @fastify/multipart)",
    );
  }
  const result: ParsedMultipart = { meta: undefined };
  for await (const part of reqAny.parts()) {
    if (part.type === "file") {
      const buf = await part.toBuffer();
      result.file = { filename: part.filename, buffer: buf };
    } else if (part.fieldname === "meta") {
      try {
        result.meta = JSON.parse(part.value);
      } catch {
        throw new HttpError(400, "'meta' field must be valid JSON");
      }
    }
  }
  return result;
}
