import test from 'node:test';
import assert from 'node:assert';
import { SmokeScanner } from '../src/engine/scanner.js';

test('SmokeScanner - extracts element counts from HTML markup', () => {
  const scanner = new SmokeScanner();
  const mockHtml = `
    <!DOCTYPE html>
    <html>
      <head><title>Test App</title></head>
      <body>
        <h1>Title</h1>
        <h2>Sub</h2>
        <button>Click</button>
        <button>Submit</button>
        <input type="text">
        <textarea></textarea>
        <form><input type="password"></form>
        <img src="logo.png">
        <a href="/">Home</a>
      </body>
    </html>
  `;

  const counts = scanner.extractElementCounts(mockHtml);
  assert.strictEqual(counts.buttons, 2);
  assert.strictEqual(counts.inputs, 3);
  assert.strictEqual(counts.forms, 1);
  assert.strictEqual(counts.headings, 2);
  assert.strictEqual(counts.links, 1);
  assert.strictEqual(counts.images, 1);
});

test('SmokeScanner - computes deterministic structural DOM hash', () => {
  const scanner = new SmokeScanner();
  const html1 = '<html><body><h1>Hello</h1><!-- comment --></body></html>';
  const html2 = '<html><body><h1>Hello</h1> </body></html>';

  const hash1 = scanner.computeDomHash(html1);
  const hash2 = scanner.computeDomHash(html2);
  assert.strictEqual(hash1, hash2, 'DOM hash should ignore comments and extra whitespaces');
});
