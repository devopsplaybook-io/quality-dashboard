/**
 * A logical, named report. Multiple uploads with the same key produce
 * additional ReportVersion entries — but the Report itself remains a single
 * row keyed by `key`.
 */
export class Report {
  /** Unique stable identifier (slug-like). Set by the uploader. */
  public key: string;
  /** Optional human-readable label. Falls back to `key` if absent. */
  public displayName: string | null;
  /** When this report key was first seen. */
  public dateCreated: Date;

  constructor() {
    this.key = "";
    this.displayName = null;
    this.dateCreated = new Date();
  }
}
