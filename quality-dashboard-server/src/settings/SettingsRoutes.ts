import { FastifyInstance, RequestGenericInterface } from "fastify";
import { Auth } from "../users/Auth";
import { SettingsDB } from "./SettingsDB";
import { OTelLogger, OTelRequestSpan } from "../OTelContext";
import { UsersData } from "../users/UsersData";

const logger = OTelLogger().createModuleLogger("SettingsRoutes");

export class SettingsRoutes {
  //
  public async getRoutes(fastify: FastifyInstance): Promise<void> {
    fastify.get("/", async (req, res) => {
      logger.info(`[${req.method}] ${req.url}`);
      const context = OTelRequestSpan(req);
      const settings = await SettingsDB.get(context);
      const isInitialized = (await UsersData.list(context)).length > 0;
      const userSession = await Auth.getUserSession(req);
      const payload: Record<string, unknown> = {
        isDashboardPublic: settings.isDashboardPublic,
        isInitialized,
      };
      if (userSession.isAuthenticated) {
        payload.uploadToken = settings.uploadToken;
      }
      return res.status(200).send(payload);
    });

    interface UpdateSettingsRequest extends RequestGenericInterface {
      Body: {
        isDashboardPublic?: boolean;
        uploadToken?: string;
      };
    }
    fastify.put<UpdateSettingsRequest>("/", async (req, res) => {
      logger.info(`[${req.method}] ${req.url}`);
      const context = OTelRequestSpan(req);
      const userSession = await Auth.getUserSession(req);
      if (!userSession.isAuthenticated) {
        return res.status(403).send({ error: "Access Denied" });
      }
      const next = await SettingsDB.update(context, {
        isDashboardPublic: req.body.isDashboardPublic,
        uploadToken: req.body.uploadToken,
      });
      return res.status(202).send(next);
    });
  }
}
