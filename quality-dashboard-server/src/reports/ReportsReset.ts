import * as path from "path";
import { Config } from "../Config";
import { ReportsData } from "./ReportsData";
import { Logger } from "../utils-std-ts/logger";
import { FastifyInstance, FastifyRequest, RequestGenericInterface } from "fastify";

const logger = new Logger(path.basename(__filename));

async function routes(fastify: FastifyInstance): Promise<void> {
  //
  fastify.delete(`${Config.API_BASE_PATH}/reports/`, async (req, res) => {
    if (process.env.DEV_MODE !== "dev") {
      return res.status(404).send({ error: "ERR: Reset forbidden for non dev environment" });
    }
    ReportsData.reset();
    return res.status(202).send({});
  });
}

module.exports = routes;
