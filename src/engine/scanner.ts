import { createHash } from 'node:crypto';
import { EndpointInspection, DOMElementCounts, InvariantViolation } from '../types.js';

export class SmokeScanner {
  private timeoutMs: number;

  constructor(timeoutMs: number = 8000) {
    this.timeoutMs = timeoutMs;
  }

  /**
   * Inspects a target URL or localhost port for visual and DOM invariants
   */
  public async inspect(targetUrl: string): Promise<EndpointInspection> {
    const startTime = performance.now();
    let url = targetUrl;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `http://${url}`;
    }

    const violations: InvariantViolation[] = [];

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'VisualSmoke/1.0 (+https://alphatech.studio)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Connection': 'close'
        }
      });
      clearTimeout(timer);

      const latencyMs = Math.round(performance.now() - startTime);
      const text = await response.text();
      const contentLength = Buffer.byteLength(text, 'utf-8');

      // 1. Status Code Invariants
      if (response.status >= 500) {
        violations.push({
          code: 'HTTP_5XX_SERVER_FAULT',
          severity: 'critical',
          message: `Server returned HTTP ${response.status} (${response.statusText})`,
          actual: response.status
        });
      } else if (response.status >= 400) {
        violations.push({
          code: 'HTTP_4XX_CLIENT_FAULT',
          severity: 'critical',
          message: `Endpoint returned HTTP ${response.status} (${response.statusText})`,
          actual: response.status
        });
      }

      // 2. Latency Invariants
      if (latencyMs > 1500) {
        violations.push({
          code: 'LATENCY_DEGRADATION_P99',
          severity: 'critical',
          message: `Response time ${latencyMs}ms exceeded critical threshold of 1500ms`,
          expected: '<1500ms',
          actual: `${latencyMs}ms`
        });
      } else if (latencyMs > 500) {
        violations.push({
          code: 'LATENCY_WARNING',
          severity: 'warning',
          message: `Response time ${latencyMs}ms exceeded warning threshold of 500ms`,
          expected: '<500ms',
          actual: `${latencyMs}ms`
        });
      }

      // 3. Extract DOM Invariants
      const title = this.extractTitle(text);
      if (!title || title.trim() === '') {
        violations.push({
          code: 'MISSING_DOCUMENT_TITLE',
          severity: 'warning',
          message: 'Document is missing a non-empty <title> tag'
        });
      }

      const hasViewportMeta = /<meta[^>]+name=["']viewport["']/i.test(text);
      if (!hasViewportMeta) {
        violations.push({
          code: 'MISSING_VIEWPORT_META',
          severity: 'warning',
          message: 'Document lacks a responsive <meta name="viewport"> tag'
        });
      }

      // 4. White Screen of Death (WSOD) check
      if (text.length < 50 || !/<body[^>]*>/i.test(text)) {
        violations.push({
          code: 'WHITE_SCREEN_OF_DEATH',
          severity: 'critical',
          message: 'Page returned empty or missing <body> tag (WSOD)'
        });
      }

      const elementCounts = this.extractElementCounts(text);
      const domHash = this.computeDomHash(text);

      const headers: Record<string, string> = {};
      response.headers.forEach((val, key) => {
        headers[key] = val;
      });

      const passed = !violations.some(v => v.severity === 'critical');

      return {
        url,
        statusCode: response.status,
        statusText: response.statusText,
        latencyMs,
        contentLength,
        contentType: response.headers.get('content-type') || 'text/html',
        headers,
        domHash,
        elementCounts,
        title: title || 'Untitled Document',
        hasViewportMeta,
        hasBrokenLinks: false,
        violations,
        passed,
        timestamp: Date.now()
      };
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - startTime);
      violations.push({
        code: 'CONNECTION_REFUSED_OR_TIMEOUT',
        severity: 'critical',
        message: `Failed to connect to ${url}: ${err.message}`
      });

      return {
        url,
        statusCode: 0,
        statusText: 'ERR_CONNECTION_FAILED',
        latencyMs,
        contentLength: 0,
        contentType: 'unknown',
        headers: {},
        domHash: '0000000000000000',
        elementCounts: {
          buttons: 0,
          inputs: 0,
          forms: 0,
          headings: 0,
          links: 0,
          images: 0,
          scripts: 0,
          styles: 0
        },
        title: 'Connection Error',
        hasViewportMeta: false,
        hasBrokenLinks: false,
        violations,
        passed: false,
        timestamp: Date.now()
      };
    }
  }

  private extractTitle(html: string): string {
    const match = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
    return match ? match[1].trim() : '';
  }

  public extractElementCounts(html: string): DOMElementCounts {
    const countTag = (tag: string) => {
      const reg = new RegExp(`<${tag}[^>]*>`, 'gi');
      return (html.match(reg) || []).length;
    };

    return {
      buttons: countTag('button'),
      inputs: countTag('input') + countTag('textarea') + countTag('select'),
      forms: countTag('form'),
      headings: countTag('h1') + countTag('h2') + countTag('h3'),
      links: countTag('a'),
      images: countTag('img') + countTag('svg'),
      scripts: countTag('script'),
      styles: countTag('style') + (html.match(/<link[^>]+rel=["']stylesheet["']/gi) || []).length
    };
  }

  public computeDomHash(html: string): string {
    // Strip dynamic timestamps, scripts, comments to get structural layout hash
    const normalized = html
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/>\s+</g, '><')
      .replace(/\s+/g, ' ')
      .trim();

    return createHash('sha256').update(normalized).digest('hex').substring(0, 16);
  }
}
