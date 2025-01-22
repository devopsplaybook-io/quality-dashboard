import { v4 as uuidv4 } from "uuid";
import { Label } from "./Labels";
import { ReportResult } from "./ReportResult";

export class Report {
  public id: string;
  public name: string;
  public processor: string;
  public labels: any;
  public results: ReportResult[];
  public dateCreated: Date;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public info: any;

  constructor() {
    this.id = uuidv4();
    this.labels = {};
    this.results = [];
    this.info = {};
  }
}
