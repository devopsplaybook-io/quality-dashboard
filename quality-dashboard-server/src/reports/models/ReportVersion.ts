import { v4 as uuidv4 } from "uuid";
import { Metric } from "./Metric";

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public info: any;
  public dateCreated: Date;

  constructor() {
    this.id = uuidv4();
    this.reportKey = "";
    this.processor = "";
    this.metrics = [];
    this.hasFile = false;
    this.info = {};
    this.dateCreated = new Date();
  }
}
