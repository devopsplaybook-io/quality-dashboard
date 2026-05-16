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
  public REPORT_DIR = this.DATA_DIR + "/reports";
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
  public OPENTELEMETRY_COLLECTOR_HTTP_TRACES: string = "";
  public OPENTELEMETRY_COLLECTOR_HTTP_METRICS: string = "";
  public OPENTELEMETRY_COLLECTOR_HTTP_LOGS: string = "";
  public OPENTELEMETRY_COLLECTOR_EXPORT_LOGS_INTERVAL_SECONDS: number = 5;
  public OPENTELEMETRY_COLLECTOR_EXPORT_METRICS_INTERVAL_SECONDS: number = 10;
  public OPENTELEMETRY_COLLECTOR_AWS = false;
  public OPENTELEMETRY_COLLECT_AUTHORIZATION_HEADER: string = "";

  public async reload(): Promise<void> {
    const content = await fse.readJson(this.CONFIG_FILE);
    const setIfSet = (field: string, displayLog = true) => {
      let fromEnv = "defaults";
      if (process.env[field]) {
        this[field] = process.env[field];
        fromEnv = "environment";
      } else if (content[field]) {
        this[field] = content[field];
        fromEnv = "config";
      }
      if (displayLog) {
        logger.info(
          `Configuration Value: ${field}: ${this[field]} (from ${fromEnv})`,
        );
      } else {
        logger.info(
          `Configuration Value: ${field}: ******************** (from ${fromEnv})`,
        );
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
    setIfSet("OPENTELEMETRY_COLLECTOR_HTTP_TRACES");
    setIfSet("OPENTELEMETRY_COLLECTOR_HTTP_METRICS");
    setIfSet("OPENTELEMETRY_COLLECTOR_HTTP_LOGS");
    setIfSet("OPENTELEMETRY_COLLECTOR_EXPORT_LOGS_INTERVAL_SECONDS");
    setIfSet("OPENTELEMETRY_COLLECTOR_EXPORT_METRICS_INTERVAL_SECONDS");
    setIfSet("OPENTELEMETRY_COLLECTOR_AWS");
    setIfSet("OPENTELEMETRY_COLLECT_AUTHORIZATION_HEADER", false);
  }
}
