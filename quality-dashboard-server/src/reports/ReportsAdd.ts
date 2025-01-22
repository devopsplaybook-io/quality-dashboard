import * as fse from "fs-extra";
import * as path from "path";
import * as targz from "targz";
import * as util from "util";
import { pipeline } from "stream";
import { Config } from "../Config";
import { ReportsData } from "./ReportsData";
import { Logger } from "../utils-std-ts/logger";
import { FastifyInstance, FastifyRequest, RequestGenericInterface } from "fastify";
import { Auth } from "./Auth";

const logger = new Logger(path.basename(__filename));

async function routes(fastify: FastifyInstance): Promise<void> {
  //
}

module.exports = routes;

