import Fastify from "fastify";
import { watchFile } from "fs-extra";
import * as path from "path";
import { Config } from "./Config";
import { Logger } from "./utils-std-ts/Logger";
import { Auth } from "./users/Auth";
import { ReportsDataInit } from "./reports/ReportsData";
import { SettingsRoutes } from "./settings/SettingsRoutes";
import { UsersRoutes } from "./users/UsersRoutes";
import { ReportsRoutes, ReportsRoutesInit } from "./reports/ReportsRoutes";
import { StandardTracerInitTelemetry, StandardTracerStartSpan } from "./utils-std-ts/StandardTracer";
import { SqlDbUtilsInit } from "./utils-std-ts/SqlDbUtils";
import { StandardTracerApiRegisterHooks } from "./StandardTracerApi";

const logger = new Logger(path.basename(__filename));

logger.info("====== Quality Dashboard Server ======");

Promise.resolve()
  .then(async () => {
    //
    const config = new Config();
    await config.reload();
    watchFile(config.CONFIG_FILE, () => {
      logger.info(`Config updated: ${config.CONFIG_FILE}`);
      config.reload();
    });

    StandardTracerInitTelemetry(config);

    const span = StandardTracerStartSpan("init");

    await SqlDbUtilsInit(span, config);
    await Auth.init(span, config);
    await ReportsDataInit(span, config);
    await ReportsRoutesInit(span, config);

    span.end();

    // await SettingsDB.init();
    // await UsersDB.init();
    const fastify = Fastify({
      logger: false,
      ignoreTrailingSlash: true,
    });

    /* eslint-disable @typescript-eslint/no-var-requires */

    fastify.register(require("@fastify/cors"), {
      origin: config.CORS_POLICY_ORIGIN,
      methods: "GET,PUT,POST,DELETE",
    });
    fastify.register(require("@fastify/multipart"), {
      attachFieldsToBody: true,
    });
    StandardTracerApiRegisterHooks(fastify, config);

    fastify.register(new SettingsRoutes().getRoutes, {
      prefix: "/api/settings",
    });

    fastify.register(new UsersRoutes().getRoutes, {
      prefix: "/api/users",
    });

    fastify.register(new ReportsRoutes().getRoutes, {
      prefix: "/api/reports",
    });

    // fastify.register(require('@fastify/static'), {
    //   root: path.join(Config.REPORT_DIR),
    //   prefix: `${Config.API_BASE_PATH}/reports_data/`,
    // });

    fastify.listen({ port: config.API_PORT, host: "0.0.0.0" }, (err) => {
      if (err) {
        logger.error(err);
        fastify.log.error(err);
        process.exit(1);
      }
      logger.info("API Listerning");
    });
  })
  .catch((err) => {
    console.log(err);
    logger.error(err.message);
    process.exit(1);
  });
