// VisualSmoke Client Application Logic

const targetUrlInput = document.getElementById('targetUrlInput');
const btnRunScan = document.getElementById('btnRunScan');
const btnSetBaseline = document.getElementById('btnSetBaseline');
const kpiVerdict = document.getElementById('kpiVerdict');
const kpiVerdictDesc = document.getElementById('kpiVerdictDesc');
const kpiEndpoints = document.getElementById('kpiEndpoints');
const kpiLatency = document.getElementById('kpiLatency');
const kpiDrift = document.getElementById('kpiDrift');
const inspectionsList = document.getElementById('inspectionsList');
const violationCountBadge = document.getElementById('violationCountBadge');
const previewIframe = document.getElementById('previewIframe');
const btnPreviewDesktop = document.getElementById('btnPreviewDesktop');
const btnPreviewMobile = document.getElementById('btnPreviewMobile');
const toast = document.getElementById('toast');
const targetChips = document.querySelectorAll('.target-chip');

async function runScan() {
  const urlValue = targetUrlInput.value.trim();
  if (!urlValue) return;

  showToast('Running Visual Smoke Invariant Scan...', 'info');

  try {
    const res = await fetch(`/api/scan?url=${encodeURIComponent(urlValue)}`);
    const data = await res.json();

    if (data.success && data.summary) {
      renderSummary(data.summary);
      showToast('✓ Smoke scan completed successfully!');
    }
  } catch (err) {
    showToast('Failed to run smoke scan', 'error');
  }
}

async function setBaseline() {
  try {
    const res = await fetch('/api/baseline', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('✓ Saved current inspections as active baseline!');
      runScan();
    }
  } catch {
    showToast('Failed to save baseline', 'error');
  }
}

function renderSummary(summary) {
  // Update KPIs
  kpiVerdict.textContent = summary.verdict;
  if (summary.verdict === 'PASS') {
    kpiVerdict.className = 'kpi-value text-emerald';
    kpiVerdictDesc.textContent = 'All visual and DOM invariants verified';
  } else if (summary.verdict === 'WARN') {
    kpiVerdict.className = 'kpi-value text-amber';
    kpiVerdictDesc.textContent = 'Minor DOM drift or latency warnings';
  } else {
    kpiVerdict.className = 'kpi-value text-red';
    kpiVerdictDesc.textContent = 'Critical invariant violations detected';
  }

  kpiEndpoints.textContent = `${summary.passedEndpoints} / ${summary.totalEndpoints}`;
  kpiLatency.textContent = `${summary.averageLatencyMs}ms`;

  const totalViolations = summary.criticalViolationsCount + summary.warningViolationsCount;
  violationCountBadge.textContent = `${totalViolations} Invariants Tracked`;
  if (summary.criticalViolationsCount > 0) {
    violationCountBadge.className = 'count-badge has-errors';
  } else {
    violationCountBadge.className = 'count-badge';
  }

  // Calculate drift
  let maxDrift = 0;
  for (const diff of summary.diffs) {
    if (diff.driftPercentage > maxDrift) maxDrift = diff.driftPercentage;
  }
  kpiDrift.textContent = `${maxDrift.toFixed(1)}%`;

  // Render Inspections List
  inspectionsList.innerHTML = '';
  summary.inspections.forEach((insp, idx) => {
    const diff = summary.diffs[idx];
    const isPassed = insp.passed;
    const card = document.createElement('div');
    card.className = 'inspection-card';

    const statusBadgeCls = isPassed ? 'status-pass' : 'status-fail';
    const statusText = insp.statusCode ? `${insp.statusCode} ${insp.statusText}` : 'CONNECTION ERROR';

    let violationsHtml = '';
    const allViolations = [...insp.violations, ...(diff?.violations || [])];
    if (allViolations.length > 0) {
      violationsHtml = `
        <div class="violations-box">
          ${allViolations.map(v => `
            <div class="violation-row">
              <span>${v.severity === 'critical' ? '🔴' : '⚠️'}</span>
              <div class="violation-msg"><strong>[${v.code}]</strong> ${v.message}</div>
            </div>
          `).join('')}
        </div>
      `;
    }

    card.innerHTML = `
      <div class="card-top">
        <div class="card-url-title">
          <span class="status-badge ${statusBadgeCls}">${statusText}</span>
          <span class="card-url">${insp.url}</span>
        </div>
        <span class="card-latency">${insp.latencyMs}ms</span>
      </div>

      <div class="elements-pill-strip">
        <span class="elem-pill">DOM: ${insp.domHash}</span>
        <span class="elem-pill">Buttons: ${insp.elementCounts.buttons}</span>
        <span class="elem-pill">Inputs: ${insp.elementCounts.inputs}</span>
        <span class="elem-pill">Headings: ${insp.elementCounts.headings}</span>
        <span class="elem-pill">Images: ${insp.elementCounts.images}</span>
      </div>

      ${violationsHtml}
    `;

    card.addEventListener('click', () => {
      previewIframe.src = insp.url;
    });

    inspectionsList.appendChild(card);
  });

  // Set first preview
  if (summary.inspections.length > 0) {
    previewIframe.src = summary.inspections[0].url;
  }
}

// Quick target chips
targetChips.forEach(chip => {
  chip.addEventListener('click', () => {
    targetChips.forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    targetUrlInput.value = chip.dataset.url;
    runScan();
  });
});

btnRunScan.addEventListener('click', runScan);
btnSetBaseline.addEventListener('click', setBaseline);

targetUrlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') runScan();
});

// Viewport preview toggle
btnPreviewDesktop.addEventListener('click', () => {
  btnPreviewDesktop.classList.add('active');
  btnPreviewMobile.classList.remove('active');
  previewIframe.classList.remove('mobile');
});

btnPreviewMobile.addEventListener('click', () => {
  btnPreviewMobile.classList.add('active');
  btnPreviewDesktop.classList.remove('active');
  previewIframe.classList.add('mobile');
});

function showToast(msg, type = 'info') {
  toast.textContent = msg;
  toast.className = `toast-notification show ${type}`;
  setTimeout(() => {
    toast.className = 'toast-notification';
  }, 3200);
}

// Auto run initial scan on load
window.addEventListener('DOMContentLoaded', () => {
  runScan();
});
