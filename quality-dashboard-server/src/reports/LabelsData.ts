import * as fse from "fs-extra";
import * as _ from "lodash";
import * as path from "path";
import { Config } from "../Config";
import { Logger } from "../utils-std-ts/Logger";
import { Span } from "@opentelemetry/sdk-trace-base";
import { Report } from "./models/Report";
import { StandardTracerStartSpan } from "../utils-std-ts/StandardTracer";
import { SqlDbUtilsQuerySQL } from "../utils-std-ts/SqlDbUtils";
import { Label } from "./models/Labels";

const logger = new Logger(path.basename(__filename));
let config: Config;
let REPORT_FOLDER;

export async function LabelsDataGetByNameValue(context: Span, name: string, value: string): Promise<Label> {
  const span = StandardTracerStartSpan("LabelsDataGet", context);
  const labelRaw = await SqlDbUtilsQuerySQL(span, "SELECT * FROM labels WHERE name = ? AND value = ?", [name, value]);
  let label = null;
  if (labelRaw.length > 0) {
    label = new Label();
    label.id = labelRaw[0].id;
    label.name = labelRaw[0].name;
    label.value = labelRaw[0].value;
  }
  span.end();
  return label;
}

export async function LabelsDataAdd(context: Span, label: Label): Promise<void> {
  const span = StandardTracerStartSpan("LabelsDataAdd", context);
  await SqlDbUtilsQuerySQL(span, "INSERT INTO labels (id, name, value) VALUES (?, ?, ?)", [
    label.id,
    label.name,
    label.value,
  ]);
  span.end();
}

export async function LabelsDataLinkToReport(context: Span, label: Label, report: Report): Promise<void> {
  const span = StandardTracerStartSpan("LabelsDataLinkToReport", context);
  await SqlDbUtilsQuerySQL(span, "INSERT INTO reports_labels (labelId, reportId) VALUES (?, ?)", [label.id, report.id]);
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
