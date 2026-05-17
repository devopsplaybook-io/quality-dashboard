import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Auth } from "../users/Auth";
import { OTelRequestSpan } from "../OTelContext";
import { ReportsRepository } from "./ReportsRepository";
import { TagsRepository } from "./TagsRepository";
import { SettingsDB } from "../settings/SettingsDB";

export class TagsRoutes {
  //
  public async getRoutes(fastify: FastifyInstance): Promise<void> {
    //
    // ---- Discover all tags / values --------------------------------------
    fastify.get("/", async (req, res) => {
      if (!(await ensureCanRead(req, res))) {
        return;
      }
      const span = OTelRequestSpan(req);
      const all = await TagsRepository.listAllTags(span);
      // Group by tag for convenience
      const byTag = new Map<string, Set<string>>();
      for (const t of all) {
        if (!byTag.has(t.tag)) {
          byTag.set(t.tag, new Set());
        }
        byTag.get(t.tag)!.add(t.value);
      }
      return res.status(200).send({
        tags: Array.from(byTag.entries())
          .map(([tag, values]) => ({
            tag,
            values: Array.from(values).sort(),
          }))
          .sort((a, b) => a.tag.localeCompare(b.tag)),
      });
    });

    // ---- List tags for a report ------------------------------------------
    fastify.get<{ Params: { key: string } }>(
      "/reports/:key",
      async (req, res) => {
        if (!(await ensureCanRead(req, res))) {
          return;
        }
        const span = OTelRequestSpan(req);
        const report = await ReportsRepository.getReport(span, req.params.key);
        if (!report) {
          return res.status(404).send({ error: "Report not found" });
        }
        const tags = await TagsRepository.listTagsForReport(span, report.key);
        return res
          .status(200)
          .send({ tags: tags.map((t) => ({ tag: t.tag, value: t.value })) });
      },
    );

    // ---- Replace all tags for a report -----------------------------------
    fastify.put<{
      Params: { key: string };
      Body: { tags?: { tag: string; value: string }[] };
    }>("/reports/:key", async (req, res) => {
      if (!(await ensureAuthenticated(req, res))) {
        return;
      }
      const span = OTelRequestSpan(req);
      const report = await ReportsRepository.getReport(span, req.params.key);
      if (!report) {
        return res.status(404).send({ error: "Report not found" });
      }
      const incoming = Array.isArray(req.body?.tags) ? req.body!.tags! : [];
      // Validate
      for (const t of incoming) {
        if (!t || typeof t.tag !== "string" || typeof t.value !== "string") {
          return res
            .status(400)
            .send({ error: "Each tag must be { tag: string, value: string }" });
        }
        if (!t.tag.trim() || !t.value.trim()) {
          return res
            .status(400)
            .send({ error: "Tag and value must be non-empty" });
        }
      }
      await TagsRepository.replaceTagsForReport(span, report.key, incoming);
      return res.status(200).send({});
    });

    // ---- Set/update one tag for a report ---------------------------------
    fastify.put<{
      Params: { key: string; tag: string };
      Body: { value?: string };
    }>("/reports/:key/:tag", async (req, res) => {
      if (!(await ensureAuthenticated(req, res))) {
        return;
      }
      const value = String(req.body?.value || "").trim();
      if (!value) {
        return res.status(400).send({ error: "Field required: value" });
      }
      const span = OTelRequestSpan(req);
      const report = await ReportsRepository.getReport(span, req.params.key);
      if (!report) {
        return res.status(404).send({ error: "Report not found" });
      }
      await TagsRepository.setTag(span, report.key, req.params.tag, value);
      return res.status(200).send({});
    });

    // ---- Delete one tag from a report ------------------------------------
    fastify.delete<{ Params: { key: string; tag: string } }>(
      "/reports/:key/:tag",
      async (req, res) => {
        if (!(await ensureAuthenticated(req, res))) {
          return;
        }
        const span = OTelRequestSpan(req);
        await TagsRepository.removeTag(span, req.params.key, req.params.tag);
        return res.status(200).send({});
      },
    );
  }
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
