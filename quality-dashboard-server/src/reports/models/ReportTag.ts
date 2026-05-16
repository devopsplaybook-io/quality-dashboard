/**
 * A tag attached to a Report (not a specific version).
 * Each (reportKey, tag) has exactly one value.
 */
export interface ReportTag {
  reportKey: string;
  tag: string;
  value: string;
}
