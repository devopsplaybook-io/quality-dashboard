import { Report } from "./Report";
import { ReportVersion } from "./ReportVersion";
import { Dashboard, DASHBOARD_SCHEMA_VERSION } from "./Dashboard";
import { MetricType, MetricTypeValues } from "./MetricType";
import { Metric } from "./Metric";

describe("Report", () => {
  it("should create a report with default values", () => {
    const report = new Report();
    expect(report.key).toBe("");
    expect(report.displayName).toBeNull();
    expect(report.dateCreated).toBeInstanceOf(Date);
  });

  it("should allow setting properties", () => {
    const report = new Report();
    report.key = "test-report";
    report.displayName = "Test Report";
    expect(report.key).toBe("test-report");
    expect(report.displayName).toBe("Test Report");
  });
});

describe("ReportVersion", () => {
  it("should create a version with default values", () => {
    const version = new ReportVersion();
    expect(version.id).toBeTruthy();
    expect(typeof version.id).toBe("string");
    expect(version.reportKey).toBe("");
    expect(version.processor).toBe("");
    expect(version.metrics).toEqual([]);
    expect(version.hasFile).toBe(false);
    expect(version.info).toEqual({});
    expect(version.dateCreated).toBeInstanceOf(Date);
  });

  it("should accept metrics", () => {
    const version = new ReportVersion();
    const metrics: Metric[] = [
      { name: "test-metric", type: MetricType.count, value: 42 },
    ];
    version.metrics = metrics;
    version.reportKey = "my-report";
    version.processor = "my-processor";
    expect(version.metrics).toHaveLength(1);
    expect(version.metrics[0].name).toBe("test-metric");
    expect(version.metrics[0].value).toBe(42);
  });
});

describe("Dashboard", () => {
  it("should create a dashboard with default values", () => {
    const dashboard = new Dashboard();
    expect(dashboard.id).toBeTruthy();
    expect(typeof dashboard.id).toBe("string");
    expect(dashboard.name).toBe("");
    expect(dashboard.schemaVersion).toBe(DASHBOARD_SCHEMA_VERSION);
    expect(dashboard.root).toEqual([]);
    expect(dashboard.shownMetrics).toBeUndefined();
    expect(dashboard.dateCreated).toBeInstanceOf(Date);
    expect(dashboard.dateModified).toBeInstanceOf(Date);
  });

  it("should have same created and modified dates initially", () => {
    const dashboard = new Dashboard();
    expect(dashboard.dateModified.getTime()).toBe(
      dashboard.dateCreated.getTime(),
    );
  });
});

describe("MetricType", () => {
  it("should have all expected metric types", () => {
    expect(MetricType.count).toBe("count");
    expect(MetricType.percentage).toBe("percentage");
    expect(MetricType.duration).toBe("duration");
    expect(MetricType.boolean).toBe("boolean");
  });

  it("should have MetricTypeValues matching the enum", () => {
    expect(MetricTypeValues).toEqual([
      "count",
      "percentage",
      "duration",
      "boolean",
    ]);
  });
});
