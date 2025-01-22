import * as fse from "fs-extra";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { Logger } from "./utils-std-ts/Logger";
import { ConfigInterface } from "./utils-std-ts/models/ConfigInterface";

const logger = new Logger("config");

export class Config implements ConfigInterface {
  //
  public readonly CONFIG_FILE: string = "config.json";
  public readonly SERVICE_ID = "quality-dashboard-server";
  public readonly VERSION = 2;
  public readonly API_PORT: number = 8080;
  public readonly PROCESSORS_SYSTEM_DIR = path.join(__dirname, "../processors_system");

  // Can be set with config
  public JWT_VALIDITY_DURATION: number = 31 * 24 * 3600;
  public CORS_POLICY_ORIGIN: string;
  public TMP_DIR = process.env.TMP_DIR || "/tmp";
  public DATA_DIR = process.env.DATA_DIR || "/data";
  public REPORT_DIR = process.env.DATA_DIR + "/reports" || "/data/reports";
  public JWT_KEY: string = uuidv4();
  public LOG_LEVEL = "info";
  public OPENTELEMETRY_COLLECTOR_HTTP: string = process.env.OPENTELEMETRY_COLLECTOR_HTTP || "";
  public OPENTELEMETRY_COLLECTOR_AWS = process.env.OPENTELEMETRY_COLLECTOR_AWS === "true";
  public PROCESSORS_CUSTOM_DIR = path.join(__dirname, "../processors_custom");

  public async reload(): Promise<void> {
    const content = await fse.readJson(this.CONFIG_FILE);
    const setIfSet = (field: string, displayLog = true) => {
      if (content[field]) {
        this[field] = content[field];
      }
      if (displayLog) {
        logger.info(`Configuration Value: ${field}: ${this[field]}`);
      } else {
        logger.info(`Configuration Value: ${field}: ********************`);
      }
    };
    logger.info(`Configuration Value: CONFIG_FILE: ${this.CONFIG_FILE}`);
    logger.info(`Configuration Value: VERSION: ${this.VERSION}`);
    setIfSet("JWT_VALIDITY_DURATION");
    setIfSet("CORS_POLICY_ORIGIN");
    setIfSet("DATA_DIR");
    setIfSet("JWT_KEY", false);
    setIfSet("LOG_LEVEL");
    setIfSet("PROCESSORS_CUSTOM_DIR");
    setIfSet("OPENTELEMETRY_COLLECTOR_HTTP");
    setIfSet("OPENTELEMETRY_COLLECTOR_AWS");
  }
}
