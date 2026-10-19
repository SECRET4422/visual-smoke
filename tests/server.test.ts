import test from 'node:test';
import assert from 'node:assert';
import { createVisualSmokeServer } from '../src/server.js';
import { AddressInfo } from 'node:net';

test('VisualSmoke Server - serves demo endpoints, scan API, and closes cleanly', async () => {
  const { server } = createVisualSmokeServer();

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // 1. Test Demo Clean Endpoint
    const cleanRes = await fetch(`${baseUrl}/demo/clean`, {
      headers: { 'Connection': 'close' }
    });
    assert.strictEqual(cleanRes.status, 200);
    const cleanHtml = await cleanRes.text();
    assert.ok(cleanHtml.includes('Production Fleet v1.0'));

    // 2. Test Demo Degraded Endpoint
    const degradedRes = await fetch(`${baseUrl}/demo/degraded`, {
      headers: { 'Connection': 'close' }
    });
    assert.strictEqual(degradedRes.status, 200);
    const degradedHtml = await degradedRes.text();
    assert.ok(degradedHtml.includes('Degraded Staging Site'));

    // 3. Test API Scan
    const scanRes = await fetch(`${baseUrl}/api/scan?url=${encodeURIComponent(`${baseUrl}/demo/clean`)}`, {
      headers: { 'Connection': 'close' }
    });
    assert.strictEqual(scanRes.status, 200);
    const scanData = await scanRes.json();
    assert.strictEqual(scanData.success, true);
    assert.strictEqual(scanData.summary.verdict, 'PASS');

    // 4. Test API Baseline
    const baselineRes = await fetch(`${baseUrl}/api/baseline`, {
      method: 'POST',
      headers: { 'Connection': 'close' }
    });
    assert.strictEqual(baselineRes.status, 200);
    const baselineData = await baselineRes.json();
    assert.strictEqual(baselineData.success, true);

  } finally {
    // Safe teardown
    (server as any).closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
