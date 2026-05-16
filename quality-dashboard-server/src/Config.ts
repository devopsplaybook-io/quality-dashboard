import * as fse from "fs-extra";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { ConfigOTelInterface } from "@devopsplaybook.io/otel-utils";
import { Logger } from "./utils-std-ts/Logger";

const logger = new Logger("config");

export class Config implements ConfigOTelInterface {
  //
  public readonly CONFIG_FILE: string = "config.json";
  public readonly SERVICE_ID = "quality-dashboard-server";
  public VERSION = "2";
  public readonly API_PORT: number = 8080;
  public readonly PROCESSORS_SYSTEM_DIR = path.join(
    __dirname,
    "../processors_system",
  );

  // Can be set with config
  public JWT_VALIDITY_DURATION: number = 31 * 24 * 3600;
  public CORS_POLICY_ORIGIN: string;
  public TMP_DIR = process.env.TMP_DIR || "/tmp";
  public DATA_DIR = process.env.DATA_DIR || "/data";
  public REPORT_DIR = process.env.DATA_DIR + "/reports" || "/data/reports";
  public JWT_KEY: string = uuidv4();
  public LOG_LEVEL = "info";
  public PROCESSORS_CUSTOM_DIR = path.join(__dirname, "../processors_custom");
  public PROCESSOR_TIMEOUT_MS: number = Number(
    process.env.PROCESSOR_TIMEOUT_MS || 30000,
  );
  public MAX_UPLOAD_BYTES: number = Number(
    process.env.MAX_UPLOAD_BYTES || 200 * 1024 * 1024,
  );

  // OpenTelemetry configuration
  public OPENTELEMETRY_COLLECTOR_HTTP_TRACES: string =
    process.env.OPENTELEMETRY_COLLECTOR_HTTP_TRACES ||
    process.env.OPENTELEMETRY_COLLECTOR_HTTP ||
    "";
  public OPENTELEMETRY_COLLECTOR_HTTP_METRICS: string =
    process.env.OPENTELEMETRY_COLLECTOR_HTTP_METRICS || "";
  public OPENTELEMETRY_COLLECTOR_HTTP_LOGS: string =
    process.env.OPENTELEMETRY_COLLECTOR_HTTP_LOGS || "";
  public OPENTELEMETRY_COLLECTOR_EXPORT_LOGS_INTERVAL_SECONDS: number = 5;
  public OPENTELEMETRY_COLLECTOR_EXPORT_METRICS_INTERVAL_SECONDS: number = 10;
  public OPENTELEMETRY_COLLECTOR_AWS =
    process.env.OPENTELEMETRY_COLLECTOR_AWS === "true";
  public OPENTELEMETRY_COLLECT_AUTHORIZATION_HEADER =
    process.env.OPENTELEMETRY_COLLECT_AUTHORIZATION_HEADER || "";

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
    setIfSet("PROCESSOR_TIMEOUT_MS");
    setIfSet("MAX_UPLOAD_BYTES");
    setIfSet("OPENTELEMETRY_COLLECTOR_HTTP");
    setIfSet("OPENTELEMETRY_COLLECTOR_AWS");
  }
}
