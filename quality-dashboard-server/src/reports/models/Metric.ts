import { MetricType } from "./MetricType";

export interface Metric {
  name: string;
  type: MetricType;
  value: number;
}
