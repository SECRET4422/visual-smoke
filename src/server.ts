import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SmokeScanner } from './engine/scanner.js';
import { RegressionDiffer } from './engine/differ.js';
import { EndpointInspection, SmokeSummary } from './types.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC_DIR = join(__dirname, '../../public');

export function createVisualSmokeServer() {
  const scanner = new SmokeScanner();
  const differ = new RegressionDiffer();

  let latestInspections: EndpointInspection[] = [];
  let latestSummary: SmokeSummary = {
    totalEndpoints: 0,
    passedEndpoints: 0,
    failedEndpoints: 0,
    averageLatencyMs: 0,
    criticalViolationsCount: 0,
    warningViolationsCount: 0,
    verdict: 'PASS',
    inspections: [],
    diffs: [],
    timestamp: Date.now()
  };

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    // Built-in Demo Endpoints for zero-config demonstration
    if (pathname === '/demo/clean') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AlphaTech Production Fleet</title>
  <style>body { font-family: sans-serif; background: #0b0f19; color: #fff; padding: 2rem; }</style>
</head>
<body>
  <h1>Production Fleet v1.0</h1>
  <p>All nodes healthy. Zero regression drift.</p>
  <button id="btnAction">Trigger Deploy</button>
  <form><input type="text" placeholder="Filter agents..."></form>
</body>
</html>`);
      return;
    }

    if (pathname === '/demo/degraded') {
      // Missing title, missing viewport meta, degraded latency
      await new Promise(r => setTimeout(r, 120));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html>
<html>
<head>
  <!-- Missing viewport and title -->
</head>
<body>
  <h1>Degraded Staging Site</h1>
  <p>Warning: Unregistered layout shift and latency spike detected.</p>
</body>
</html>`);
      return;
    }

    // API: Trigger Scan
    if (req.method === 'GET' && pathname === '/api/scan') {
      const targetParam = url.searchParams.get('url') || 'http://localhost:4040/demo/clean';
      const targets = targetParam.split(',').map(t => t.trim()).filter(Boolean);

      const inspections: EndpointInspection[] = [];
      const diffs = [];

      for (const target of targets) {
        const inspection = await scanner.inspect(target);
        const diff = differ.compare(inspection);
        inspections.push(inspection);
        diffs.push(diff);
      }

      latestInspections = inspections;
      latestSummary = differ.summarize(inspections, diffs);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, summary: latestSummary }));
      return;
    }

    // API: Get Latest Summary
    if (req.method === 'GET' && pathname === '/api/summary') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, summary: latestSummary }));
      return;
    }

    // API: Baseline snapshot
    if (req.method === 'POST' && pathname === '/api/baseline') {
      for (const insp of latestInspections) {
        differ.saveBaseline(insp);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Baselines updated successfully' }));
      return;
    }

    // Static Asset Delivery
    let filePath = join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
    if (!existsSync(filePath)) {
      filePath = join(PUBLIC_DIR, 'index.html');
    }

    try {
      const content = readFileSync(filePath);
      const ext = extname(filePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.svg': 'image/svg+xml'
      };

      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
      res.end(content);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  });

  return { server, scanner, differ };
}
