import { SettingsDB } from "./SettingsDB";
import { FastifyInstance, RequestGenericInterface } from "fastify";
import { Logger } from "../utils-std-ts/Logger";

const logger = new Logger('SettingsRoutes');


export class SettingsRoutes {
  //
  public async getRoutes(fastify: FastifyInstance): Promise<void> {

    fastify.get('/', async (req, res) => {
      // logger.debug(`[${req.method}] ${req.url}`);
      // // const auth = await Auth.checkAuthHeader(req.headers);
      // return res.status(200).send({
      //   isDashboardPublic: (await SettingsDB.get()).isDashboardPublic,
      //   isInitialized: await UsersDB.isInitialized()
      // });
    });

    interface UpdateSettingsRequest extends RequestGenericInterface {
      Body: {
        isDashboardPublic: boolean;
        uploadToken: string;
      };
    }
    fastify.put<UpdateSettingsRequest>('/', async (req, res) => {
      logger.info(`[${req.method}] ${req.url}`);
      // const auth = await Auth.checkAuthHeader(req.headers);
      // if (!auth.authenticated) {
      //   return res.status(403).send({});
      // }
      await SettingsDB.update({ isDashboardPublic: req.body.isDashboardPublic, uploadToken: req.body.uploadToken });
      return res.status(202).send({});
    });

  }
}