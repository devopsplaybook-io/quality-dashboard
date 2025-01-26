import { Auth } from "../users/Auth";
import { Config } from "../Config";
import { FastifyInstance, RequestGenericInterface } from "fastify";
import { Logger } from "../utils-std-ts/Logger";
import { ReportsData, ReportsDataAdd, ReportsDataGetDataDir, ReportsDataGetTmpDir } from "./ReportsData";
import { Span } from "@opentelemetry/sdk-trace-base";
import { StandardTracerGetSpanFromRequest } from "../utils-std-ts/StandardTracer";
import * as fse from "fs-extra";
import * as path from "path";
import * as targz from "targz";
import { Report } from "./models/Report";

const logger = new Logger("ReportsRoutes");
let config: Config;

export function ReportsRoutesInit(context: Span, configIn: Config) {
  config = configIn;
}

export class ReportsRoutes {
  //
  public async getRoutes(fastify: FastifyInstance): Promise<void> {
    //
    fastify.get("/", async (req, res) => {
      logger.debug(`[${req.method}] ${req.url}`);
      // const userSession = await Auth.getUserSession(req);
      // const isDashboardPublic = (await SettingsDB.get()).isDashboardPublic;
      // if (!isDashboardPublic && !auth.authenticated) {
      //   return res.status(403).send({});
      // }
      return res.status(200).send(await ReportsData.list(StandardTracerGetSpanFromRequest(req)));
    });

    interface AddReportRequest extends RequestGenericInterface {
      Body: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        json: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        file: any;
      };
    }
    fastify.post<AddReportRequest>("/", async (req, res) => {
      const context = StandardTracerGetSpanFromRequest(req);
      logger.info(`[${req.method}] ${req.url}`);
      // const userSession = await Auth.getUserSession(req);

      // if (!auth.authenticated && !auth.validUploadToken ) {
      //   return res.status(403).send({});
      // }

      if (!req.headers["content-type"].startsWith("multipart/form-data")) {
        return res.status(400).send({ error: "Request must be multipart/form-data" });
      }
      if (!req.body.json) {
        return res.status(403).send({ error: "Field Missing: 'json'" });
      }
      if (!req.body.json.value.name) {
        return res.status(403).send({ error: "Data Missing: 'name'" });
      }
      if (!req.body.json.value.processor) {
        return res.status(403).send({ error: "Data Missing: 'processor'" });
      }
      if (!req.body.json.value.labels) {
        return res.status(403).send({ error: "Data Missing: 'labels'" });
      }

      const report = new Report();
      report.name = req.body.json.value.name;
      report.processor = req.body.json.value.processor;
      report.labels = req.body.json.value.labels;
      report.dateCreated = new Date();
      report.info.labels = report.labels;

      // File
      await fse.ensureDir(ReportsDataGetTmpDir(report));
      if (req.body.file && path.extname(req.body.file.filename) === ".gz") {
        await fse.writeFile(`${ReportsDataGetTmpDir(report)}/report.tar.gz`, await req.body.file.toBuffer());
        await extractTo(
          `${ReportsDataGetTmpDir(report)}/_report.tar.gz`,
          `${ReportsDataGetTmpDir(report)}/report`
        ).catch((err) => {
          logger.error(`Failed to extract report: ${err.message}`);
          throw new Error(`Failed to extract report: ${err.message}`);
        });
      } else if (req.body.file && path.extname(req.body.file.filename) === ".html") {
        await fse.ensureDir(`${ReportsDataGetTmpDir(report)}/report`);
        await fse.writeFile(`${ReportsDataGetTmpDir(report)}/report/report.html`, await req.body.file.toBuffer());
      } else if (req.body.json) {
        await fse.ensureDir(`${ReportsDataGetTmpDir(report)}/report`);
        await fse.writeJson(`${ReportsDataGetTmpDir(report)}/report/data.json`, req.body.json.value);
      } else {
        return res.status(400).send({ error: "ERR: Wrong report data: file (html or tar.gz) or json expected" });
      }

      // Report Record

      let processor;
      if (fse.existsSync(`${config.PROCESSORS_CUSTOM_DIR}/${report.processor}.js`)) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        processor = require(`${config.PROCESSORS_CUSTOM_DIR}/${report.processor}.js`);
      } else if (fse.existsSync(`${config.PROCESSORS_SYSTEM_DIR}/${report.processor}.js`)) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        processor = require(`${config.PROCESSORS_SYSTEM_DIR}/${report.processor}.js`);
      }
      if (!processor) {
        logger.error(`Processor not found: ${report.processor}`);
        return res.status(404).send({ error: "ERR: Procesor not found" });
      }
      try {
        report.results = await processor.analyse(`${ReportsDataGetTmpDir(report)}/report`);
      } catch (err) {
        logger.error(`Procesor processing report: ${err}`);
        return res.status(404).send({ error: "ERR: Procesor processing report" });
      }

      await fse.move(ReportsDataGetTmpDir(report), ReportsDataGetDataDir(report));
      await ReportsDataAdd(context, report);
      return res.status(201).send({});
    });
  }
}

function extractTo(src: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    targz.decompress(
      {
        dest,
        src,
      },
      async (err) => {
        if (err) {
          logger.error(err);
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
}
