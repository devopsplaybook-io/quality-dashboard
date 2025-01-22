import * as fse from "fs-extra";
import * as _ from "lodash";
import * as path from "path";
import { Config } from "../Config";
import { Span } from "@opentelemetry/sdk-trace-base";
import { Logger } from "../utils-std-ts/Logger";

const logger = new Logger(path.basename(__filename));

export class SettingsDB {
  //
  public static async init(context: Span, config: Config): Promise<void> {
    // await fse.ensureDir(Config.DB_DIR);
    // if (!fse.existsSync(DB_FILE_PATH)) {
    //   await fse.writeJSON(DB_FILE_PATH, {});
    // }
    // settingsDB = await fse.readJSON(DB_FILE_PATH);
    // if (!settingsDB.uploadToken) {
    //   settingsDB.uploadToken = "";
    // }
    // if (!settingsDB.isDashboardPublic) {
    //   settingsDB.isDashboardPublic = false;
    // }
    // await fse.writeJSON(DB_FILE_PATH, settingsDB, { spaces: 2 });
  }

  // public static get(): Promise<any> {
  //   return JsonTools.clone(settingsDB);
  // }

  public static async update(settings: any): Promise<void> {
    // settingsDB.isDashboardPublic = settings.isDashboardPublic;
    // settingsDB.uploadToken = settings.uploadToken;
    // await fse.writeJSON(DB_FILE_PATH, settingsDB, { spaces: 2 });
  }

  // public static async setUploadToken(token: string): Promise<any> {
  //   settingsDB.uploadToken = token;
  //   await fse.writeJSON(DB_FILE_PATH, settingsDB, { spaces: 2 });
  // }
}
