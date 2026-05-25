import { v4 as uuidv4 } from "uuid";

/**
 * One node in a Dashboard's level tree.
 *  - id: stable identifier (uuid) used for editor keys; persisted as part of the definition.
 *  - tag: required. The tag this node filters/groups by.
 *  - value: optional.
 *      - If set: only reports with this exact tag=value belong to this branch.
 *      - If absent: group by every distinct value seen for this tag among matching reports.
 *  - children: ordered list of sub-level nodes. Empty array for leaf nodes.
 */
export interface DashboardLevelNode {
  id: string;
  tag: string;
  value?: string;
  children: DashboardLevelNode[];
}

/**
 * Wrapper persisted as JSON in `dashboards.definition`.
 * Storing a wrapper (vs a bare array) keeps the door open for future top-level fields
 * (e.g. default expanded depth, default sort) without another schema migration.
 */
export interface DashboardDefinition {
  schemaVersion: number;
  root: DashboardLevelNode[];
  /**
   * Optional list of glob patterns to filter which metrics appear at each
   * aggregated node level. If undefined or empty, all metrics are shown.
   * Applied on the UI layer only; report-level metrics are unaffected.
   * Wildcards: * matches any sequence, ? matches a single character.
   */
  shownMetrics?: string[];
}

export const DASHBOARD_SCHEMA_VERSION = 3;

export class Dashboard {
  public id: string;
  public name: string;
  public schemaVersion: number;
  public root: DashboardLevelNode[];
  public shownMetrics?: string[];
  public dateCreated: Date;
  public dateModified: Date;

  constructor() {
    this.id = uuidv4();
    this.name = "";
    this.schemaVersion = DASHBOARD_SCHEMA_VERSION;
    this.root = [];
    this.shownMetrics = undefined;
    this.dateCreated = new Date();
    this.dateModified = this.dateCreated;
  }
}
