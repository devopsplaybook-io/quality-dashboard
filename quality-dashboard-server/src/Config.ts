import { ConfigBase } from "@devopsplaybook.io/common-utils";
import path from "path";
import { OTelLogger } from "./OTelContext";

const logger = OTelLogger().createModuleLogger("config");

export class Config extends ConfigBase {
  // Project-specific fields
  public TMP_DIR = process.env.TMP_DIR || "/tmp";
  public REPORT_DIR = this.DATA_DIR + "/reports";
  public LOG_LEVEL = "info";
  public PROCESSORS_SYSTEM_DIR = path.join(__dirname, "../processors_system");
  public PROCESSORS_CUSTOM_DIR = path.join(__dirname, "../processors_custom");
  public PROCESSOR_TIMEOUT_MS = Number(
    process.env.PROCESSOR_TIMEOUT_MS || 30000,
  );
  public MAX_UPLOAD_BYTES = Number(
    process.env.MAX_UPLOAD_BYTES || 200 * 1024 * 1024,
  );

  constructor() {
    super("quality-dashboard-server");
    this.VERSION = "2";

    // Register project-specific fields so reload() processes them
    this.addConfigField({ field: "TMP_DIR" });
    this.addConfigField({ field: "PROCESSORS_CUSTOM_DIR" });
    this.addConfigField({ field: "PROCESSOR_TIMEOUT_MS" });
    this.addConfigField({ field: "MAX_UPLOAD_BYTES" });
  }

  public async reload(): Promise<void> {
    await super.reload((message: string) => logger.info(message));
    // Keep REPORT_DIR in sync when DATA_DIR changes
    this.REPORT_DIR = this.DATA_DIR + "/reports";
  }
}
