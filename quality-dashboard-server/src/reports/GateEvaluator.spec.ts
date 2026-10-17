import { GateEvaluator } from "./GateEvaluator";
import { GateRule } from "./models/GateRule";
import { Metric } from "./models/Metric";
import { MetricType } from "./models/MetricType";

function rule(partial: Partial<GateRule>): GateRule {
  return {
    id: "rule-1",
    metric: "tests.failed",
    operator: "<=",
    failValue: 0,
    dateCreated: new Date(),
    ...partial,
  };
}

function metric(name: string, value: number): Metric {
  return { name, type: MetricType.count, value };
}

describe("GateEvaluator", () => {
  //
  test("no rules ⇒ null status and empty results", () => {
    const result = GateEvaluator.evaluate([], [metric("tests.failed", 1)]);
    expect(result.status).toBeNull();
    expect(result.results).toEqual([]);
  });

  test("rule with missing metric is skipped, not failed", () => {
    const result = GateEvaluator.evaluate(
      [rule({ metric: "coverage.lines", operator: ">=", failValue: 80 })],
      [metric("tests.failed", 0)],
    );
    expect(result.status).toBeNull();
    expect(result.results).toEqual([]);
  });

  describe("operator <= (lower is better)", () => {
    //
    test("fail when value > failValue", () => {
      const result = GateEvaluator.evaluate([rule({ failValue: 0 })], [
        metric("tests.failed", 2),
      ]);
      expect(result.status).toEqual("fail");
      expect(result.results).toEqual([
        {
          ruleId: "rule-1",
          metric: "tests.failed",
          operator: "<=",
          value: 2,
          status: "fail",
        },
      ]);
    });

    test("pass when value == failValue", () => {
      const result = GateEvaluator.evaluate([rule({ failValue: 0 })], [
        metric("tests.failed", 0),
      ]);
      expect(result.status).toEqual("pass");
    });

    test("warn when value > warnValue but <= failValue", () => {
      const result = GateEvaluator.evaluate(
        [rule({ failValue: 10, warnValue: 2 })],
        [metric("tests.failed", 5)],
      );
      expect(result.status).toEqual("warn");
    });

    test("pass when value == warnValue", () => {
      const result = GateEvaluator.evaluate(
        [rule({ failValue: 10, warnValue: 2 })],
        [metric("tests.failed", 2)],
      );
      expect(result.status).toEqual("pass");
    });

    test("fail takes precedence over warn", () => {
      const result = GateEvaluator.evaluate(
        [rule({ failValue: 10, warnValue: 2 })],
        [metric("tests.failed", 11)],
      );
      expect(result.status).toEqual("fail");
    });
  });

  describe("operator >= (higher is better)", () => {
    //
    test("fail when value < failValue", () => {
      const result = GateEvaluator.evaluate(
        [rule({ metric: "coverage.lines", operator: ">=", failValue: 80 })],
        [metric("coverage.lines", 72)],
      );
      expect(result.status).toEqual("fail");
      expect(result.results[0].value).toEqual(72);
    });

    test("pass when value == failValue", () => {
      const result = GateEvaluator.evaluate(
        [rule({ metric: "coverage.lines", operator: ">=", failValue: 80 })],
        [metric("coverage.lines", 80)],
      );
      expect(result.status).toEqual("pass");
    });

    test("warn when value < warnValue but >= failValue", () => {
      const result = GateEvaluator.evaluate(
        [
          rule({
            metric: "coverage.lines",
            operator: ">=",
            failValue: 60,
            warnValue: 80,
          }),
        ],
        [metric("coverage.lines", 70)],
      );
      expect(result.status).toEqual("warn");
    });

    test("pass when value == warnValue", () => {
      const result = GateEvaluator.evaluate(
        [
          rule({
            metric: "coverage.lines",
            operator: ">=",
            failValue: 60,
            warnValue: 80,
          }),
        ],
        [metric("coverage.lines", 80)],
      );
      expect(result.status).toEqual("pass");
    });

    test("fail takes precedence over warn", () => {
      const result = GateEvaluator.evaluate(
        [
          rule({
            metric: "coverage.lines",
            operator: ">=",
            failValue: 60,
            warnValue: 80,
          }),
        ],
        [metric("coverage.lines", 59)],
      );
      expect(result.status).toEqual("fail");
    });
  });

  test("multiple rules ⇒ worst-of wins", () => {
    const result = GateEvaluator.evaluate(
      [
        rule({ id: "r1", metric: "tests.failed", operator: "<=", failValue: 0 }),
        rule({
          id: "r2",
          metric: "coverage.lines",
          operator: ">=",
          failValue: 80,
        }),
      ],
      [metric("tests.failed", 0), metric("coverage.lines", 70)],
    );
    expect(result.status).toEqual("fail");
  });

  test("warn beats pass across rules", () => {
    const result = GateEvaluator.evaluate(
      [
        rule({ id: "r1", metric: "tests.failed", operator: "<=", failValue: 5 }),
        rule({
          id: "r2",
          metric: "coverage.lines",
          operator: ">=",
          failValue: 50,
          warnValue: 80,
        }),
      ],
      [metric("tests.failed", 1), metric("coverage.lines", 70)],
    );
    expect(result.status).toEqual("warn");
  });

  test("boolean metric works as 0/1", () => {
    const result = GateEvaluator.evaluate(
      [rule({ metric: "build.green", operator: ">=", failValue: 1 })],
      [{ name: "build.green", type: MetricType.boolean, value: 0 }],
    );
    expect(result.status).toEqual("fail");
    expect(result.results[0].value).toEqual(0);
  });
});
