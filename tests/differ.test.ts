import test from 'node:test';
import assert from 'node:assert';
import { RegressionDiffer } from '../src/engine/differ.js';
import { EndpointInspection } from '../src/types.js';

test('RegressionDiffer - detects DOM drift and calculates deltas', () => {
  const differ = new RegressionDiffer();

  const baseInspection: EndpointInspection = {
    url: 'http://localhost:3000',
    statusCode: 200,
    statusText: 'OK',
    latencyMs: 25,
    contentLength: 500,
    contentType: 'text/html',
    headers: {},
    domHash: 'hash-v1',
    elementCounts: {
      buttons: 5,
      inputs: 2,
      forms: 1,
      headings: 3,
      links: 10,
      images: 4,
      scripts: 2,
      styles: 1
    },
    title: 'Fleet App',
    hasViewportMeta: true,
    hasBrokenLinks: false,
    violations: [],
    passed: true,
    timestamp: 1000
  };

  // First run sets baseline
  const diffInitial = differ.compare(baseInspection);
  assert.strictEqual(diffInitial.hasDrift, false);
  assert.strictEqual(diffInitial.domHashMatch, true);

  // Subsequent run with changed button count
  const updatedInspection: EndpointInspection = {
    ...baseInspection,
    domHash: 'hash-v2',
    elementCounts: {
      ...baseInspection.elementCounts,
      buttons: 8 // +3 buttons
    }
  };

  const diffUpdated = differ.compare(updatedInspection);
  assert.strictEqual(diffUpdated.hasDrift, true);
  assert.strictEqual(diffUpdated.domHashMatch, false);
  assert.ok(diffUpdated.driftPercentage > 0);

  const btnDiff = diffUpdated.elementDiffs.find(d => d.element === 'buttons');
  assert.ok(btnDiff);
  assert.strictEqual(btnDiff.delta, 3);
});

test('RegressionDiffer - summarizes multiple inspection results', () => {
  const differ = new RegressionDiffer();

  const inspection: EndpointInspection = {
    url: 'http://localhost:3000',
    statusCode: 200,
    statusText: 'OK',
    latencyMs: 30,
    contentLength: 200,
    contentType: 'text/html',
    headers: {},
    domHash: 'hash-a',
    elementCounts: { buttons: 1, inputs: 1, forms: 0, headings: 1, links: 1, images: 1, scripts: 1, styles: 1 },
    title: 'Clean Site',
    hasViewportMeta: true,
    hasBrokenLinks: false,
    violations: [],
    passed: true,
    timestamp: 2000
  };

  const diff = differ.compare(inspection);
  const summary = differ.summarize([inspection], [diff]);

  assert.strictEqual(summary.totalEndpoints, 1);
  assert.strictEqual(summary.passedEndpoints, 1);
  assert.strictEqual(summary.failedEndpoints, 0);
  assert.strictEqual(summary.verdict, 'PASS');
});
