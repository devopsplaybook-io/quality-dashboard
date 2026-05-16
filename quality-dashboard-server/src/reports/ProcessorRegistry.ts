import * as fse from "fs-extra";
import * as fs from "fs";
import * as path from "path";
import { Config } from "../Config";
import { OTelLogger } from "../OTelContext";
import { Metric } from "./models/Metric";
import { MetricType, MetricTypeValues } from "./models/MetricType";

const logger = OTelLogger().createModuleLogger("ProcessorRegistry");

export interface ProcessorContext {
  reportDir: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jsonPayload?: any;
}

export interface ProcessorResult {
  fileEntrypoint?: string;
  metrics: Metric[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  info?: any;
}

export interface ProcessorDescriptor {
  name: string;
  source: "system" | "custom";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  describe?: any;
}

interface ProcessorModule {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  describe?: () => any;
  analyse: (ctx: ProcessorContext) => Promise<ProcessorResult>;
}

interface CachedProcessor {
  filePath: string;
  source: "system" | "custom";
  module: ProcessorModule;
}

const cache = new Map<string, CachedProcessor>();
let config: Config;

export function ProcessorRegistryInit(configIn: Config): void {
  config = configIn;
  loadAll();
  watchDir(config.PROCESSORS_SYSTEM_DIR, "system");
  watchDir(config.PROCESSORS_CUSTOM_DIR, "custom");
}

function loadAll(): void {
  cache.clear();
  loadDir(config.PROCESSORS_SYSTEM_DIR, "system");
  loadDir(config.PROCESSORS_CUSTOM_DIR, "custom");
  logger.info(`Loaded ${cache.size} processor(s)`);
}

function loadDir(dir: string, source: "system" | "custom"): void {
  if (!fse.existsSync(dir)) {
    return;
  }
  const files = fse.readdirSync(dir).filter((f) => f.endsWith(".js"));
  for (const file of files) {
    const name = path.basename(file, ".js");
    const filePath = path.join(dir, file);
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      delete require.cache[require.resolve(filePath)];
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require(filePath) as ProcessorModule;
      if (typeof mod.analyse !== "function") {
        logger.error(`Processor ${name} missing analyse(): skipped`);
        continue;
      }
      // Custom overrides system
      if (source === "custom" || !cache.has(name)) {
        cache.set(name, { filePath, source, module: mod });
      }
    } catch (err) {
      logger.error(`Failed to load processor ${file}: ${err}`);
    }
  }
}

function watchDir(dir: string, source: "system" | "custom"): void {
  if (!fse.existsSync(dir)) {
    return;
  }
  try {
    fs.watch(dir, { persistent: false }, (_event, filename) => {
      if (!filename || !filename.endsWith(".js")) {
        return;
      }
      logger.info(`Processor change detected (${source}): ${filename}`);
      loadAll();
    });
  } catch (err) {
    logger.error(`Cannot watch processor dir ${dir}: ${err}`);
  }
}

export function listProcessors(): ProcessorDescriptor[] {
  const result: ProcessorDescriptor[] = [];
  for (const [name, entry] of cache.entries()) {
    let describe;
    try {
      describe = entry.module.describe?.();
    } catch {
      describe = undefined;
    }
    result.push({ name, source: entry.source, describe });
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

export function hasProcessor(name: string): boolean {
  return cache.has(name);
}

export async function runProcessor(
  name: string,
  ctx: ProcessorContext,
  timeoutMs: number,
): Promise<ProcessorResult> {
  const entry = cache.get(name);
  if (!entry) {
    throw new Error(`Processor not found: ${name}`);
  }

  const result = await withTimeout(entry.module.analyse(ctx), timeoutMs, name);
  return validateResult(name, result);
}

function withTimeout<T>(p: Promise<T>, ms: number, name: string): Promise<T> {
  let handle: NodeJS.Timeout;
  const timeout = new Promise<T>((_resolve, reject) => {
    handle = setTimeout(() => {
      reject(new Error(`Processor '${name}' timed out after ${ms}ms`));
    }, ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(handle));
}

function validateResult(name: string, raw: ProcessorResult): ProcessorResult {
  if (!raw || typeof raw !== "object") {
    throw new Error(`Processor '${name}' returned a non-object result`);
  }
  if (!Array.isArray(raw.metrics)) {
    throw new Error(`Processor '${name}' must return metrics: []`);
  }
  const metrics: Metric[] = [];
  for (const m of raw.metrics) {
    if (!m || typeof m.name !== "string" || !m.name) {
      throw new Error(`Processor '${name}' returned a metric without a name`);
    }
    if (!MetricTypeValues.includes(m.type)) {
      throw new Error(
        `Processor '${name}' metric '${m.name}' has invalid type '${m.type}'`,
      );
    }
    let value: number;
    if (m.type === MetricType.boolean) {
      value = m.value ? 1 : 0;
    } else {
      value = Number(m.value);
      if (!Number.isFinite(value)) {
        throw new Error(
          `Processor '${name}' metric '${m.name}' value is not finite`,
        );
      }
    }
    metrics.push({ name: m.name, type: m.type as MetricType, value });
  }
  return {
    fileEntrypoint:
      typeof raw.fileEntrypoint === "string" ? raw.fileEntrypoint : undefined,
    metrics,
    info: raw.info && typeof raw.info === "object" ? raw.info : {},
  };
}
