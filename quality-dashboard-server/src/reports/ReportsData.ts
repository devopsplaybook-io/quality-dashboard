import * as fse from "fs-extra";
import * as _ from "lodash";
import * as path from "path";
import { Config } from "../Config";
import { Logger } from "../utils-std-ts/Logger";
import { Span } from "@opentelemetry/sdk-trace-base";
import { Report } from "./models/Report";
import { StandardTracerStartSpan } from "../utils-std-ts/StandardTracer";
import { SqlDbUtilsQuerySQL } from "../utils-std-ts/SqlDbUtils";
import { LabelsDataAdd, LabelsDataGetByNameValue, LabelsDataLinkToReport } from "./LabelsData";
import { Label } from "./models/Labels";

const logger = new Logger(path.basename(__filename));
let config: Config;
let REPORT_FOLDER;

export async function ReportsDataInit(context: Span, configIn: Config): Promise<void> {
  config = configIn;
  REPORT_FOLDER = path.join(config.DATA_DIR, "reports");
  await fse.ensureDir(REPORT_FOLDER);
  // cleanGroups();
}

export function ReportsDataGetDataDir(report: Report): string {
  return `${config.REPORT_DIR}/${report.id[0]}/${report.id[1]}/${report.id[2]}/${report.id}`;
}

export function ReportsDataGetTmpDir(report: Report): string {
  return `${config.TMP_DIR}/${report.id}`;
}

export async function ReportsDataAdd(context: Span, report: Report): Promise<void> {
  const span = StandardTracerStartSpan("ReportsDataAdd", context);
  await SqlDbUtilsQuerySQL(
    span,
    "INSERT INTO reports (id, name, processor, results, info, dateCreated) VALUES (?, ?, ?, ?, ?, ?)",
    [
      report.id,
      report.name,
      report.processor,
      JSON.stringify(report.results),
      JSON.stringify(report.info),
      report.dateCreated.toISOString(),
    ]
  );
  for (const labelKey of Object.keys(report.labels)) {
    let label = await LabelsDataGetByNameValue(span, labelKey, report.labels[labelKey]);
    if (!label) {
      label = new Label();
      label.name = labelKey;
      label.value = report.labels[labelKey];
      await LabelsDataAdd(span, label);
    }
    await LabelsDataLinkToReport(span, label, report);
  }
  span.end();
}

export class ReportsData {
  //
  public static async list(context: Span): Promise<Report[]> {
    const span = StandardTracerStartSpan("ReportsData_list", context);
    const reportsRaw = await SqlDbUtilsQuerySQL(span, "SELECT * FROM reports");
    const reports = [];
    for (const reportRaw of reportsRaw) {
      reports.push(ReportsData.fromRaw(reportRaw));
    }
    span.end();
    return reports;
  }

  // public static async analyzeFile(context: Span) {

  // }

  public static async delete(id: string): Promise<void> {
    // const group = _.find(reportsDB.groups, { name: groupName });
    // if (!group) {
    //   throw new Error(`Version not found: ${groupName}/${projectName}/${projectVersion}`);
    // }
    // const project = _.find(group.projects, { name: projectName });
    // if (!project) {
    //   throw new Error(`Version not found: ${groupName}/${projectName}/${projectVersion}`);
    // }
    // const versionIndex = _.findIndex(project.versions, { name: projectVersion });
    // if (versionIndex < 0) {
    //   throw new Error(`Version not found: ${groupName}/${projectName}/${projectVersion}`);
    // }
    // logger.info(`Deleting version: ${groupName}/${projectName}/${projectVersion}`);
    // project.versions.splice(versionIndex, 1);
    // cleanGroups();
    // await fse.writeJSON(DB_FILE_PATH, reportsDB, { spaces: 2 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static fromRaw(reportRaw: any): Report {
    const report = new Report();
    report.id = reportRaw.id;
    report.name = reportRaw.name;
    return report;
  }
}

function cleanGroups(): void {
  // const newGroups = [];
  // for (const group of reportsDB.groups) {
  //   const newProjects = [];
  //   for (const project of group.projects) {
  //     if (project.versions.length > 0) {
  //       newProjects.push(project);
  //     }
  //   }
  //   if (newProjects.length > 0) {
  //     newGroups.push({ name: group.name, projects: newProjects });
  //   }
  // }
  // reportsDB.groups = newGroups;
}
