import { v4 as uuidv4 } from "uuid";
import { Metric } from "./Metric";
import { GateResult, GateStatus } from "./GateRule";

/**
 * A single upload of a report. The same report key can have many versions.
 */
export class ReportVersion {
  public id: string;
  public reportKey: string;
  public processor: string;
  public metrics: Metric[];
  public fileEntrypoint?: string;
  public hasFile: boolean;
  public info: any;
  public dateCreated: Date;
  /** Overall quality gate status; null when the report has no gate rules. */
  public gateStatus: GateStatus | null;
  /** Per-rule evaluation snapshot (includes observed values). */
  public gateResults: GateResult[];

  constructor() {
    this.id = uuidv4();
    this.reportKey = "";
    this.processor = "";
    this.metrics = [];
    this.hasFile = false;
    this.info = {};
    this.dateCreated = new Date();
    this.gateStatus = null;
    this.gateResults = [];
  }
}
