export interface DOMElementCounts {
  buttons: number;
  inputs: number;
  forms: number;
  headings: number;
  links: number;
  images: number;
  scripts: number;
  styles: number;
}

export interface InvariantViolation {
  code: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  expected?: string | number;
  actual?: string | number;
}

export interface EndpointInspection {
  url: string;
  statusCode: number;
  statusText: string;
  latencyMs: number;
  contentLength: number;
  contentType: string;
  headers: Record<string, string>;
  domHash: string;
  elementCounts: DOMElementCounts;
  title: string;
  hasViewportMeta: boolean;
  hasBrokenLinks: boolean;
  violations: InvariantViolation[];
  passed: boolean;
  timestamp: number;
}

export interface BaselineSnapshot {
  url: string;
  timestamp: number;
  domHash: string;
  elementCounts: DOMElementCounts;
  latencyMs: number;
  statusCode: number;
}

export interface RegressionDiff {
  url: string;
  hasDrift: boolean;
  driftPercentage: number;
  domHashMatch: boolean;
  elementDiffs: {
    element: string;
    baseline: number;
    current: number;
    delta: number;
  }[];
  latencyDeltaMs: number;
  violations: InvariantViolation[];
}

export interface SmokeSummary {
  totalEndpoints: number;
  passedEndpoints: number;
  failedEndpoints: number;
  averageLatencyMs: number;
  criticalViolationsCount: number;
  warningViolationsCount: number;
  verdict: 'PASS' | 'WARN' | 'FAIL';
  inspections: EndpointInspection[];
  diffs: RegressionDiff[];
  timestamp: number;
}
