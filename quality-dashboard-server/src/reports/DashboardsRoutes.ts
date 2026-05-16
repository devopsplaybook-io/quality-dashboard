import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Auth } from "../users/Auth";
import { OTelLogger, OTelRequestSpan } from "../OTelContext";
import { DashboardsRepository } from "./DashboardsRepository";
import { ReportsRepository } from "./ReportsRepository";
import { TagsRepository } from "./TagsRepository";
import { SettingsDB } from "../settings/SettingsDB";
import { Dashboard, DashboardLevel } from "./models/Dashboard";
import { ReportVersion } from "./models/ReportVersion";
import { Metric } from "./models/Metric";
import { MetricType } from "./models/MetricType";
import { Span } from "@opentelemetry/sdk-trace-base";

const logger = OTelLogger().createModuleLogger("DashboardsRoutes");

interface AggregatedNode {
  /** "tag=value" or just "tag" if level has no fixed value (becomes the group key per value) */
  label: string;
  level: number;
  reportKeys: string[];
  metrics: Metric[];
  children: AggregatedNode[];
}

export class DashboardsRoutes {
  //
  public async getRoutes(fastify: FastifyInstance): Promise<void> {
    //
    fastify.get("/", async (req, res) => {
      logger.info(`[${req.method}] ${req.url}`);
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
      logger.info(`[${req.method}] ${req.url}`);
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

    /** Compute the aggregated view of a dashboard (latest version per report). */
    fastify.get<{ Params: { id: string } }>(
      "/:id/aggregate",
      async (req, res) => {
        logger.info(`[${req.method}] ${req.url}`);
        if (!(await ensureCanRead(req, res))) {
          return;
        }
        const span = OTelRequestSpan(req);
        const d = await DashboardsRepository.getById(span, req.params.id);
        if (!d) {
          return res.status(404).send({ error: "Dashboard not found" });
        }
        const tree = await aggregateDashboard(span, d);
        return res.status(200).send({
          dashboard: toApiDashboard(d),
          tree,
        });
      },
    );

    fastify.post<{
      Body: { name?: string; levels?: DashboardLevel[] };
    }>("/", async (req, res) => {
      logger.info(`[${req.method}] ${req.url}`);
      if (!(await ensureAuthenticated(req, res))) {
        return;
      }
      const name = (req.body?.name || "").trim();
      if (!name) {
        return res.status(400).send({ error: "Field required: name" });
      }
      const levels = sanitizeLevels(req.body?.levels);
      const dashboard = new Dashboard();
      dashboard.name = name;
      dashboard.levels = levels;
      await DashboardsRepository.add(OTelRequestSpan(req), dashboard);
      return res.status(201).send({ dashboard: toApiDashboard(dashboard) });
    });

    fastify.put<{
      Params: { id: string };
      Body: { name?: string; levels?: DashboardLevel[] };
    }>("/:id", async (req, res) => {
      logger.info(`[${req.method}] ${req.url}`);
      if (!(await ensureAuthenticated(req, res))) {
        return;
      }
      const name = (req.body?.name || "").trim();
      if (!name) {
        return res.status(400).send({ error: "Field required: name" });
      }
      const levels = sanitizeLevels(req.body?.levels);
      const ok = await DashboardsRepository.update(
        OTelRequestSpan(req),
        req.params.id,
        name,
        levels,
      );
      if (!ok) {
        return res.status(404).send({ error: "Dashboard not found" });
      }
      return res.status(200).send({});
    });

    fastify.delete<{ Params: { id: string } }>("/:id", async (req, res) => {
      logger.info(`[${req.method}] ${req.url}`);
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

function sanitizeLevels(input: DashboardLevel[] | undefined): DashboardLevel[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const out: DashboardLevel[] = [];
  for (const lvl of input) {
    if (!lvl || typeof lvl.tag !== "string" || !lvl.tag.trim()) {
      continue;
    }
    const value =
      typeof lvl.value === "string" && lvl.value.trim()
        ? lvl.value.trim()
        : undefined;
    out.push({ tag: lvl.tag.trim(), value });
  }
  return out;
}

function toApiDashboard(d: Dashboard): Record<string, unknown> {
  return {
    id: d.id,
    name: d.name,
    levels: d.levels,
    dateCreated: d.dateCreated.toISOString(),
    dateModified: d.dateModified.toISOString(),
  };
}

/**
 * Build the aggregated tree for a dashboard.
 * - Uses the latest ReportVersion per Report.
 * - Walks levels: at each level, restrict to reports having tag (and value if specified),
 *   group by value when no value is specified.
 * - Aggregates metrics bottom-up (counts/durations summed, percentages/booleans averaged).
 */
async function aggregateDashboard(
  span: Span,
  d: Dashboard,
): Promise<AggregatedNode[]> {
  const latest = await ReportsRepository.listLatestVersionsPerReport(span);
  const allKeys = latest.map((v) => v.reportKey);
  const tagsByKey = await TagsRepository.listTagsForReports(span, allKeys);
  const versionByKey = new Map(latest.map((v) => [v.reportKey, v]));

  function buildLevel(
    levelIdx: number,
    candidateKeys: string[],
  ): AggregatedNode[] {
    if (levelIdx >= d.levels.length) {
      return [];
    }
    const lvl = d.levels[levelIdx];
    // Filter candidates that have this tag
    const havingTag = candidateKeys.filter((k) =>
      (tagsByKey.get(k) || []).some(
        (t) => t.tag === lvl.tag && (lvl.value ? t.value === lvl.value : true),
      ),
    );
    if (havingTag.length === 0) {
      return [];
    }

    // Group: by tag value if none fixed; otherwise single group
    const groups = new Map<string, string[]>();
    if (lvl.value) {
      groups.set(`${lvl.tag}=${lvl.value}`, havingTag);
    } else {
      for (const k of havingTag) {
        const t = (tagsByKey.get(k) || []).find((tt) => tt.tag === lvl.tag);
        if (!t) continue;
        const label = `${lvl.tag}=${t.value}`;
        if (!groups.has(label)) {
          groups.set(label, []);
        }
        groups.get(label)!.push(k);
      }
    }

    const nodes: AggregatedNode[] = [];
    for (const [label, keys] of groups.entries()) {
      const node: AggregatedNode = {
        label,
        level: levelIdx,
        reportKeys: keys,
        metrics: [],
        children: buildLevel(levelIdx + 1, keys),
      };
      // Aggregate metrics from this group's reports (latest versions)
      const versions = keys
        .map((k) => versionByKey.get(k))
        .filter((v): v is ReportVersion => !!v);
      node.metrics = aggregateMetrics(versions);
      nodes.push(node);
    }
    nodes.sort((a, b) => a.label.localeCompare(b.label));
    return nodes;
  }

  return buildLevel(0, allKeys);
}

function aggregateMetrics(versions: ReportVersion[]): Metric[] {
  // For each metric name across versions, sum (count/duration) or average (percentage/boolean).
  const accum = new Map<
    string,
    { type: MetricType; values: number[]; samples: number }
  >();
  for (const v of versions) {
    for (const m of v.metrics) {
      let entry = accum.get(m.name);
      if (!entry) {
        entry = { type: m.type, values: [], samples: 0 };
        accum.set(m.name, entry);
      }
      entry.values.push(Number(m.value));
      entry.samples++;
    }
  }
  const out: Metric[] = [];
  for (const [name, e] of accum.entries()) {
    let value = 0;
    if (e.type === MetricType.percentage || e.type === MetricType.boolean) {
      value =
        e.values.reduce((a, b) => a + b, 0) / Math.max(1, e.values.length);
    } else {
      value = e.values.reduce((a, b) => a + b, 0);
    }
    out.push({ name, type: e.type, value });
  }
  return out;
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
