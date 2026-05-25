import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { v4 as uuidv4 } from "uuid";
import { Auth } from "../users/Auth";
import { OTelRequestSpan } from "../OTelContext";
import { DashboardsRepository } from "./DashboardsRepository";
import { ReportsRepository } from "./ReportsRepository";
import { TagsRepository } from "./TagsRepository";
import { SettingsDB } from "../settings/SettingsDB";
import {
  DASHBOARD_SCHEMA_VERSION,
  Dashboard,
  DashboardLevelNode,
} from "./models/Dashboard";

const MAX_TREE_DEPTH = 8;

export class DashboardsRoutes {
  //
  public async getRoutes(fastify: FastifyInstance): Promise<void> {
    //
    fastify.get("/", async (req, res) => {
      if (!(await ensureCanRead(req, res))) {
        return;
      }
      const span = OTelRequestSpan(req);
      const dashboards = await DashboardsRepository.list(span);
      return res.status(200).send({
        dashboards: dashboards.map(toApiDashboard),
      });
    });

    fastify.get<{ Params: { id: string } }>("/:id", async (req, res) => {
      if (!(await ensureCanRead(req, res))) {
        return;
      }
      const span = OTelRequestSpan(req);
      const d = await DashboardsRepository.getById(span, req.params.id);
      if (!d) {
        return res.status(404).send({ error: "Dashboard not found" });
      }
      return res.status(200).send({ dashboard: toApiDashboard(d) });
    });

    /**
     * Return the dashboard definition together with the raw building blocks
     * required to render it: latest version per report, its tags and metrics.
     * The actual tree-building / aggregation happens client-side.
     */
    fastify.get<{ Params: { id: string } }>("/:id/data", async (req, res) => {
      if (!(await ensureCanRead(req, res))) {
        return;
      }
      const span = OTelRequestSpan(req);
      const d = await DashboardsRepository.getById(span, req.params.id);
      if (!d) {
        return res.status(404).send({ error: "Dashboard not found" });
      }
      const latest = await ReportsRepository.listLatestVersionsPerReport(span);
      const allKeys = latest.map((v) => v.reportKey);
      const tagsByKey = await TagsRepository.listTagsForReports(span, allKeys);
      const reports = latest.map((v) => ({
        key: v.reportKey,
        tags: (tagsByKey.get(v.reportKey) || []).map((t) => ({
          tag: t.tag,
          value: t.value,
        })),
        metrics: v.metrics.map((m) => ({
          name: m.name,
          type: m.type,
          value: m.value,
        })),
        dateCreated: v.dateCreated.toISOString(),
      }));
      return res.status(200).send({
        dashboard: toApiDashboard(d),
        reports,
      });
    });

    fastify.post<{
      Body: {
        name?: string;
        root?: DashboardLevelNode[];
        shownMetrics?: string[];
      };
    }>("/", async (req, res) => {
      if (!(await ensureAuthenticated(req, res))) {
        return;
      }
      const name = (req.body?.name || "").trim();
      if (!name) {
        return res.status(400).send({ error: "Field required: name" });
      }
      const sanitized = sanitizeRoot(req.body?.root, 1, []);
      if ("error" in sanitized) {
        return res.status(400).send({ error: sanitized.error });
      }
      const shownMetricsResult = sanitizeShownMetrics(req.body?.shownMetrics);
      if (shownMetricsResult.kind === "error") {
        return res.status(400).send({ error: shownMetricsResult.error });
      }
      const dashboard = new Dashboard();
      dashboard.name = name;
      dashboard.root = sanitized.nodes;
      dashboard.shownMetrics = shownMetricsResult.value;
      await DashboardsRepository.add(OTelRequestSpan(req), dashboard);
      return res.status(201).send({ dashboard: toApiDashboard(dashboard) });
    });

    fastify.put<{
      Params: { id: string };
      Body: {
        name?: string;
        root?: DashboardLevelNode[];
        shownMetrics?: string[];
      };
    }>("/:id", async (req, res) => {
      if (!(await ensureAuthenticated(req, res))) {
        return;
      }
      const name = (req.body?.name || "").trim();
      if (!name) {
        return res.status(400).send({ error: "Field required: name" });
      }
      const sanitized = sanitizeRoot(req.body?.root, 1, []);
      if ("error" in sanitized) {
        return res.status(400).send({ error: sanitized.error });
      }
      const shownMetricsResult = sanitizeShownMetrics(req.body?.shownMetrics);
      if (shownMetricsResult.kind === "error") {
        return res.status(400).send({ error: shownMetricsResult.error });
      }
      const ok = await DashboardsRepository.update(
        OTelRequestSpan(req),
        req.params.id,
        name,
        sanitized.nodes,
        shownMetricsResult.value,
      );
      if (!ok) {
        return res.status(404).send({ error: "Dashboard not found" });
      }
      return res.status(200).send({});
    });

    fastify.delete<{ Params: { id: string } }>("/:id", async (req, res) => {
      if (!(await ensureAuthenticated(req, res))) {
        return;
      }
      const ok = await DashboardsRepository.delete(
        OTelRequestSpan(req),
        req.params.id,
      );
      if (!ok) {
        return res.status(404).send({ error: "Dashboard not found" });
      }
      return res.status(200).send({});
    });
  }
}

/**
 * Recursively normalize the level tree:
 *  - drop nodes with empty tag,
 *  - trim tag/value, treat empty value as undefined,
 *  - assign a fresh id when missing,
 *  - enforce max depth and forbid duplicate tag along the same ancestor path.
 */
function sanitizeRoot(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: any,
  depth: number,
  ancestorTags: string[],
): { nodes: DashboardLevelNode[] } | { error: string } {
  if (input === undefined || input === null) {
    return { nodes: [] };
  }
  if (!Array.isArray(input)) {
    return { error: "Invalid root: expected array" };
  }
  if (depth > MAX_TREE_DEPTH) {
    return { error: `Dashboard tree exceeds max depth (${MAX_TREE_DEPTH})` };
  }
  const out: DashboardLevelNode[] = [];
  for (const raw of input) {
    if (!raw || typeof raw.tag !== "string" || !raw.tag.trim()) {
      continue;
    }
    const tag = raw.tag.trim();
    if (ancestorTags.indexOf(tag) !== -1) {
      return {
        error: `Duplicate tag "${tag}" on the same branch is not allowed`,
      };
    }
    const value =
      typeof raw.value === "string" && raw.value.trim()
        ? raw.value.trim()
        : undefined;
    const id =
      typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : uuidv4();
    const childResult = sanitizeRoot(raw.children, depth + 1, [
      ...ancestorTags,
      tag,
    ]);
    if ("error" in childResult) {
      return childResult;
    }
    const node: DashboardLevelNode = {
      id,
      tag,
      children: childResult.nodes,
    };
    if (value !== undefined) {
      node.value = value;
    }
    out.push(node);
  }
  return { nodes: out };
}

function toApiDashboard(d: Dashboard): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: d.id,
    name: d.name,
    schemaVersion: d.schemaVersion || DASHBOARD_SCHEMA_VERSION,
    root: d.root || [],
    dateCreated: d.dateCreated.toISOString(),
    dateModified: d.dateModified.toISOString(),
  };
  if (d.shownMetrics !== undefined) {
    out.shownMetrics = d.shownMetrics;
  }
  return out;
}

/**
 * Validate and sanitize the shownMetrics array.
 * Each entry must be a non-empty string composed of word chars, dots,
 * hyphens, wildcards (*, ?), and commas. Returns the sanitized array
 * or an error object. If the input is undefined/null, returns undefined.
 */
type ShownMetricsResult =
  | { kind: "ok"; value: string[] | undefined }
  | { kind: "error"; error: string };

function sanitizeShownMetrics(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: any,
): ShownMetricsResult {
  if (input === undefined || input === null) {
    return { kind: "ok", value: undefined };
  }
  if (!Array.isArray(input)) {
    return { kind: "error", error: "shownMetrics must be an array" };
  }
  const out: string[] = [];
  const validPattern = /^[\w.*?,-]+$/;
  for (const item of input) {
    if (typeof item !== "string" || !item.trim()) {
      return {
        kind: "error",
        error: "Each shownMetrics entry must be a non-empty string",
      };
    }
    const trimmed = item.trim();
    if (!validPattern.test(trimmed)) {
      return {
        kind: "error",
        error: `Invalid metric pattern: "${trimmed}". Allowed: letters, numbers, dots, hyphens, underscores, wildcards (*, ?)`,
      };
    }
    out.push(trimmed);
  }
  return { kind: "ok", value: out.length > 0 ? out : undefined };
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
