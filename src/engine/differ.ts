import { EndpointInspection, BaselineSnapshot, RegressionDiff, SmokeSummary, InvariantViolation } from '../types.js';

export class RegressionDiffer {
  private baselines: Map<string, BaselineSnapshot> = new Map();

  public saveBaseline(inspection: EndpointInspection): BaselineSnapshot {
    const baseline: BaselineSnapshot = {
      url: inspection.url,
      timestamp: inspection.timestamp,
      domHash: inspection.domHash,
      elementCounts: { ...inspection.elementCounts },
      latencyMs: inspection.latencyMs,
      statusCode: inspection.statusCode
    };
    this.baselines.set(inspection.url, baseline);
    return baseline;
  }

  public getBaseline(url: string): BaselineSnapshot | undefined {
    return this.baselines.get(url);
  }

  public compare(current: EndpointInspection): RegressionDiff {
    const baseline = this.baselines.get(current.url);
    if (!baseline) {
      // First run: save as baseline
      this.saveBaseline(current);
      return {
        url: current.url,
        hasDrift: false,
        driftPercentage: 0,
        domHashMatch: true,
        elementDiffs: [],
        latencyDeltaMs: 0,
        violations: []
      };
    }

    const domHashMatch = baseline.domHash === current.domHash;
    const latencyDeltaMs = current.latencyMs - baseline.latencyMs;

    const elementDiffs: RegressionDiff['elementDiffs'] = [];
    let totalBase = 0;
    let totalChanges = 0;

    const keys = Object.keys(current.elementCounts) as (keyof typeof current.elementCounts)[];
    for (const key of keys) {
      const baseVal = baseline.elementCounts[key] || 0;
      const curVal = current.elementCounts[key] || 0;
      const delta = curVal - baseVal;
      totalBase += baseVal;
      totalChanges += Math.abs(delta);

      if (delta !== 0) {
        elementDiffs.push({
          element: key,
          baseline: baseVal,
          current: curVal,
          delta
        });
      }
    }

    const driftPercentage = totalBase > 0 ? Number(((totalChanges / totalBase) * 100).toFixed(1)) : 0;
    const hasDrift = !domHashMatch || driftPercentage > 0;

    const violations: InvariantViolation[] = [];
    if (!domHashMatch) {
      violations.push({
        code: 'STRUCTURAL_DOM_DRIFT',
        severity: 'warning',
        message: `Structural DOM hash diverged from baseline (${baseline.domHash} -> ${current.domHash})`,
        expected: baseline.domHash,
        actual: current.domHash
      });
    }

    if (driftPercentage > 25) {
      violations.push({
        code: 'MAJOR_LAYOUT_SHIFT_DETECTED',
        severity: 'critical',
        message: `High element volume change (${driftPercentage}% difference from baseline)`
      });
    }

    return {
      url: current.url,
      hasDrift,
      driftPercentage,
      domHashMatch,
      elementDiffs,
      latencyDeltaMs,
      violations
    };
  }

  public summarize(inspections: EndpointInspection[], diffs: RegressionDiff[]): SmokeSummary {
    const totalEndpoints = inspections.length;
    const passedEndpoints = inspections.filter(i => i.passed).length;
    const failedEndpoints = totalEndpoints - passedEndpoints;

    const totalLatency = inspections.reduce((acc, i) => acc + i.latencyMs, 0);
    const averageLatencyMs = totalEndpoints > 0 ? Math.round(totalLatency / totalEndpoints) : 0;

    let criticalViolationsCount = 0;
    let warningViolationsCount = 0;

    for (const insp of inspections) {
      for (const v of insp.violations) {
        if (v.severity === 'critical') criticalViolationsCount++;
        if (v.severity === 'warning') warningViolationsCount++;
      }
    }

    for (const d of diffs) {
      for (const v of d.violations) {
        if (v.severity === 'critical') criticalViolationsCount++;
        if (v.severity === 'warning') warningViolationsCount++;
      }
    }

    let verdict: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
    if (criticalViolationsCount > 0 || failedEndpoints > 0) {
      verdict = 'FAIL';
    } else if (warningViolationsCount > 0) {
      verdict = 'WARN';
    }

    return {
      totalEndpoints,
      passedEndpoints,
      failedEndpoints,
      averageLatencyMs,
      criticalViolationsCount,
      warningViolationsCount,
      verdict,
      inspections,
      diffs,
      timestamp: Date.now()
    };
  }
}
