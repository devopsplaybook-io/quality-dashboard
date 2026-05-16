import { StandardMeter, StandardTracer } from "@devopsplaybook.io/otel-utils";
import { StandardTracerFastifyRegisterHooks } from "@devopsplaybook.io/otel-utils-fastify";
import fastifyCors from "@fastify/cors";
import fastifyMultipart from "@fastify/multipart";
import * as fse from "fs-extra";
import Fastify from "fastify";
import { watchFile } from "fs-extra";
import { Config } from "./Config";
import { Auth } from "./users/Auth";
import { SettingsDB } from "./settings/SettingsDB";
import { SettingsRoutes } from "./settings/SettingsRoutes";
import { UsersRoutes } from "./users/UsersRoutes";
import { ReportsRoutes, ReportsRoutesInit } from "./reports/ReportsRoutes";
import { TagsRoutes } from "./reports/TagsRoutes";
import { DashboardsRoutes } from "./reports/DashboardsRoutes";
import { FileStorageInit } from "./reports/FileStorage";
import { ProcessorRegistryInit } from "./reports/ProcessorRegistry";
import { SqlDbUtilsInit } from "./utils-std-ts/SqlDbUtils";
import {
  OTelLogger,
  OTelSetMeter,
  OTelSetTracer,
  OTelTracer,
} from "./OTelContext";

const logger = OTelLogger().createModuleLogger("app");

logger.info("====== Starting Quality Dashboard Server ======");

Promise.resolve()
  .then(async () => {
    //
    const config = new Config();
    await config.reload();
    watchFile(config.CONFIG_FILE, () => {
      logger.info(`Config updated: ${config.CONFIG_FILE}`);
      config.reload();
    });

    OTelSetTracer(new StandardTracer(config));
    OTelSetMeter(new StandardMeter(config));
    OTelLogger().initOTel(config);

    const span = OTelTracer().startSpan("init");

    await SqlDbUtilsInit(span, config);
    await Auth.init(span, config);
    await SettingsDB.init(span, config);

    await fse.ensureDir(config.REPORT_DIR);
    await fse.ensureDir(config.TMP_DIR);
    FileStorageInit(config);
    ProcessorRegistryInit(config);
    ReportsRoutesInit(span, config);

    span.end();

    // APIs

    const fastify = Fastify({
      logger: config.LOG_LEVEL === process.env.FASTIFY_LOG_LEVEL,
    });

    if (config.CORS_POLICY_ORIGIN) {
      fastify.register(fastifyCors, {
        origin: config.CORS_POLICY_ORIGIN,
        methods: "GET,PUT,POST,DELETE",
      });
    }

    fastify.register(fastifyMultipart, {
      limits: {
        fileSize: config.MAX_UPLOAD_BYTES,
      },
    });

    StandardTracerFastifyRegisterHooks(fastify, OTelTracer(), OTelLogger(), {
      ignoreList: ["GET-/api/status"],
    });

    fastify.register(new SettingsRoutes().getRoutes, {
      prefix: "/api/settings",
    });

    fastify.register(new UsersRoutes().getRoutes, {
      prefix: "/api/users",
    });

    fastify.register(new ReportsRoutes().getRoutes, {
      prefix: "/api/reports",
    });

    fastify.register(new TagsRoutes().getRoutes, {
      prefix: "/api/tags",
    });

    fastify.register(new DashboardsRoutes().getRoutes, {
      prefix: "/api/dashboards",
    });

    fastify.get("/api/status", async () => {
      return { started: true };
    });

    fastify.listen({ port: config.API_PORT, host: "0.0.0.0" }, (err) => {
      if (err) {
        logger.error("Error starting API", err);
        process.exit(1);
      }
      logger.info("API Listening");
    });
  })
  .catch((err) => {
    console.log(err);
    logger.error(err.message);
    process.exit(1);
  });
