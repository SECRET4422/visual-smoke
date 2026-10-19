#!/usr/bin/env node

import { createVisualSmokeServer } from '../dist/src/server.js';
import { SmokeScanner } from '../dist/src/engine/scanner.js';
import { RegressionDiffer } from '../dist/src/engine/differ.js';
import { exec } from 'node:child_process';

const args = process.argv.slice(2);
let port = 4040;
let isCi = false;
let autoOpen = true;
let targetUrls = [];

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '-p' || arg === '--port') {
    port = parseInt(args[i + 1], 10) || 4040;
    i++;
  } else if (arg === '--ci') {
    isCi = true;
  } else if (arg === '--no-open') {
    autoOpen = false;
  } else if (arg === '-h' || arg === '--help') {
    console.log(`
  ⚡ VisualSmoke - Zero-Code Localhost Visual Smoke Testing & Regression Guard

  Usage:
    npx @ssgk4422/visual-smoke [url(s)] [options]
    visual-smoke [url(s)] [options]

  Options:
    -p, --port <number>    Port to listen on for Visual HUD (default: 4040)
    --ci                   Run once in terminal and exit (exit code 0 on PASS, 1 on FAIL)
    --no-open              Do not automatically open browser on start
    -h, --help             Show this help guide

  Examples:
    npx @ssgk4422/visual-smoke
    npx @ssgk4422/visual-smoke http://localhost:3000 --ci
    npx @ssgk4422/visual-smoke http://localhost:3000,http://localhost:5173
  `);
    process.exit(0);
  } else if (!arg.startsWith('-')) {
    targetUrls.push(...arg.split(',').map(u => u.trim()).filter(Boolean));
  }
}

// 1. Headless CI Mode
if (isCi) {
  const urls = targetUrls.length > 0 ? targetUrls : ['http://localhost:3000'];
  console.log(`\n  ⚡ VisualSmoke CI Runner: Inspecting ${urls.length} endpoint(s)...\n`);

  const scanner = new SmokeScanner();
  const differ = new RegressionDiffer();

  (async () => {
    let hasFailures = false;
    for (const url of urls) {
      const result = await scanner.inspect(url);
      const icon = result.passed ? '✓' : '✖';
      const statusStr = result.statusCode ? `${result.statusCode} ${result.statusText}` : 'CONNECTION FAILED';

      console.log(`  ${icon} [${statusStr}] ${url} (${result.latencyMs}ms)`);
      console.log(`    DOM Hash: ${result.domHash} | Buttons: ${result.elementCounts.buttons} | Inputs: ${result.elementCounts.inputs}`);

      if (result.violations.length > 0) {
        for (const v of result.violations) {
          const vIcon = v.severity === 'critical' ? '🔴' : '⚠️';
          console.log(`    ${vIcon} [${v.code}] ${v.message}`);
          if (v.severity === 'critical') hasFailures = true;
        }
      }
      console.log('');
    }

    if (hasFailures) {
      console.error(`  🔴 VisualSmoke CI Verdict: FAILED (Critical invariant violations detected)\n`);
      process.exit(1);
    } else {
      console.log(`  🟢 VisualSmoke CI Verdict: PASSED (All visual and DOM invariants verified)\n`);
      process.exit(0);
    }
  })();
} else {
  // 2. Interactive Studio HUD Mode
  const { server } = createVisualSmokeServer();

  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`
  ╔════════════════════════════════════════════════════════════════╗
  ║                                                                ║
  ║   ⚡  V I S U A L S M O K E   v1.0.0                          ║
  ║   Localhost Visual Smoke Testing & Regression Guard            ║
  ║                                                                ║
  ╚════════════════════════════════════════════════════════════════╝

  🛰️  Visual Smoke HUD:   ${url}
  🧪  Demo Environments:  ${url}/demo/clean & /demo/degraded
  🔍  Invariant Checks:   HTTP Status, DOM Hash, Broken Meta, WSOD
  ⚡  Runtime:            Zero npm runtime dependencies

  Press Ctrl+C to stop studio server.
    `);

    if (autoOpen) {
      const startCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
      exec(`${startCmd} ${url}`);
    }
  });
}
