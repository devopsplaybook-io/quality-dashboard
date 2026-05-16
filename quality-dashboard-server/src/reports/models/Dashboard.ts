import { v4 as uuidv4 } from "uuid";

/**
 * One level of a Dashboard.
 *  - tag: required. The tag this level filters/groups by.
 *  - value: optional.
 *      - If set: only reports with this exact tag=value belong to this level.
 *      - If absent: group by every value seen for this tag.
 */
export interface DashboardLevel {
  tag: string;
  value?: string;
}

export class Dashboard {
  public id: string;
  public name: string;
  public levels: DashboardLevel[];
  public dateCreated: Date;
  public dateModified: Date;

  constructor() {
    this.id = uuidv4();
    this.name = "";
    this.levels = [];
    this.dateCreated = new Date();
    this.dateModified = this.dateCreated;
  }
}
