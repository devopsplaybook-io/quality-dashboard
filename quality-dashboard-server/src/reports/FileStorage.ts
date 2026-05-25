import * as fse from "fs-extra";
import * as path from "path";
import * as targz from "targz";
import AdmZip from "adm-zip";
import { Config } from "../Config";
import { OTelLogger } from "../OTelContext";

const logger = OTelLogger().createModuleLogger("FileStorage");

let config: Config;

export function FileStorageInit(configIn: Config): void {
  config = configIn;
}

export function getReportRoot(reportId: string): string {
  return `${config.REPORT_DIR}/${reportId[0]}/${reportId[1]}/${reportId[2]}/${reportId}`;
}

export function getReportContentDir(reportId: string): string {
  return path.join(getReportRoot(reportId), "report");
}

export function getReportTmpDir(reportId: string): string {
  return path.join(config.TMP_DIR, `quality-dashboard-${reportId}`);
}

export async function ensureReportContentDir(
  reportId: string,
): Promise<string> {
  const dir = getReportContentDir(reportId);
  await fse.ensureDir(dir);
  return dir;
}

export async function ensureReportTmpDir(reportId: string): Promise<string> {
  const dir = getReportTmpDir(reportId);
  await fse.ensureDir(path.join(dir, "report"));
  return dir;
}

export async function moveTmpToFinal(reportId: string): Promise<void> {
  const finalDir = getReportRoot(reportId);
  const tmpDir = getReportTmpDir(reportId);
  await fse.ensureDir(path.dirname(finalDir));
  if (await fse.pathExists(finalDir)) {
    await fse.remove(finalDir);
  }
  await fse.move(tmpDir, finalDir, { overwrite: true });
}

export async function removeReport(reportId: string): Promise<void> {
  const finalDir = getReportRoot(reportId);
  if (await fse.pathExists(finalDir)) {
    await fse.remove(finalDir);
  }
  const tmpDir = getReportTmpDir(reportId);
  if (await fse.pathExists(tmpDir)) {
    await fse.remove(tmpDir);
  }
}

export function isArchive(filename: string): boolean {
  const lower = filename.toLowerCase();
  return (
    lower.endsWith(".tar.gz") ||
    lower.endsWith(".tgz") ||
    lower.endsWith(".zip")
  );
}

export async function extractArchive(
  src: string,
  dest: string,
  filename: string,
): Promise<void> {
  await fse.ensureDir(dest);
  const lower = filename.toLowerCase();
  if (lower.endsWith(".zip")) {
    const zip = new AdmZip(src);
    zip.extractAllTo(dest, true);
    return;
  }
  if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) {
    return new Promise((resolve, reject) => {
      targz.decompress({ src, dest }, (err) => {
        if (err) {
          logger.error(`Failed to extract tar.gz: ${err}`);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
  throw new Error(`Unsupported archive type: ${filename}`);
}

/**
 * Resolve a relative path inside a report's content directory, guarding against
 * path traversal. Returns null if the path escapes the content directory or
 * does not exist.
 */
export async function resolveSafeReportFile(
  reportId: string,
  relative: string,
): Promise<string | null> {
  const base = getReportContentDir(reportId);
  const resolved = path.resolve(base, relative || "");
  if (!resolved.startsWith(path.resolve(base))) {
    return null;
  }
  if (!(await fse.pathExists(resolved))) {
    return null;
  }
  const stat = await fse.stat(resolved);
  if (!stat.isFile()) {
    return null;
  }
  return resolved;
}
