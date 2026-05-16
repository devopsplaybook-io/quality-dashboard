import Database from "better-sqlite3";
import { Config } from "../Config";
import * as fs from "fs-extra";
import { Span } from "@opentelemetry/sdk-trace-base";
import { SpanStatusCode } from "@opentelemetry/api";
import { OTelLogger, OTelTracer } from "../OTelContext";

const logger = OTelLogger().createModuleLogger("SqlDbutils");
const SQL_DIR = `${__dirname}/../../sql`;

let database: Database.Database;

export async function SqlDbUtilsInit(
  context: Span,
  config: Config,
): Promise<void> {
  const span = OTelTracer().startSpan("SqlDbUtilsInit", context);
  await fs.ensureDir(config.DATA_DIR);
  database = new Database(`${config.DATA_DIR}/database.db`);
  SqlDbUtilsExecSQLFile(span, `${SQL_DIR}/init-0000.sql`);
  SqlDbUtilsExecSQLFile(span, `${SQL_DIR}/init-0001.sql`);
  SqlDbUtilsExecSQLFile(span, `${SQL_DIR}/init-schema.sql`);
  span.end();
}

export function SqlDbUtilsInitGetDatabase() {
  return database;
}

export function SqlDbUtilsExecSQL(
  context: Span,
  sql: string,
  params = [],
): number {
  const span = OTelTracer().startSpan("SqlDbUtilsExecSQL", context);
  try {
    const stmt = database.prepare(sql);
    const result = stmt.run(params);
    span.addEvent(`Impacted Rows: ${result.changes}`);
    span.end();
    return result.changes;
  } catch (error) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    span.end();
    throw error;
  }
}

export function SqlDbUtilsExecSQLFile(context: Span, filename: string): void {
  const span = OTelTracer().startSpan("SqlDbUtilsExecSQLFile", context);
  try {
    const sql = fs.readFileSync(filename).toString();
    database.exec(sql);
    span.end();
  } catch (error) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    span.end();
    throw error;
  }
}

export function SqlDbUtilsQuerySQL(
  context: Span,
  sql: string,
  params = [],
  debug = false,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] {
  const span = OTelTracer().startSpan("SqlDbUtilsQuerySQL", context);
  if (debug) {
    console.log(sql);
  }
  try {
    const stmt = database.prepare(sql);
    const rows = stmt.all(params);
    span.end();
    return rows;
  } catch (error) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    span.end();
    throw error;
  }
}
