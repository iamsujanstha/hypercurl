import { TestSuiteRunResult, TestStepResult, AutocannonBenchmarkResult } from '../types';

export class ReportExporter {
  /**
   * Generates a clean, standalone, styled HTML report for test suite executions.
   */
  static generateHtmlSuiteReport(result: TestSuiteRunResult): string {
    const passedCount = result.passedSteps;
    const failedCount = result.failedSteps;
    const passRate = result.totalSteps > 0 ? Math.round((passedCount / result.totalSteps) * 100) : 0;
    const dateStr = new Date(result.startTime).toUTCString();

    const stepsRowsHtml = result.stepResults.map((s, idx) => {
      const isPassed = s.status === 'passed';
      const statusBadge = isPassed
        ? '<span style="color:#10b981;background:#064e3b;padding:2px 8px;border-radius:4px;font-weight:bold;font-size:11px;">PASSED</span>'
        : '<span style="color:#f43f5e;background:#881337;padding:2px 8px;border-radius:4px;font-weight:bold;font-size:11px;">FAILED</span>';

      const assertionsHtml = s.assertions.map(a => `
        <div style="font-size:12px;margin:2px 0;color:${a.passed ? '#a7f3d0' : '#fca5a5'};">
          ${a.passed ? '✓' : '✗'} <strong>${a.type}</strong>: Expected <code>${escapeHtml(a.expected)}</code> | Actual: <code>${escapeHtml(a.actual)}</code>
          ${a.error ? `<div style="color:#fda4af;font-size:11px;padding-left:12px;">Error: ${escapeHtml(a.error)}</div>` : ''}
        </div>
      `).join('');

      return `
        <tr style="border-bottom:1px solid #1e293b;background:${idx % 2 === 0 ? '#0f172a' : '#111827'};">
          <td style="padding:10px 12px;font-family:monospace;font-size:12px;">${idx + 1}</td>
          <td style="padding:10px 12px;font-weight:600;color:#f8fafc;">${escapeHtml(s.stepName)}</td>
          <td style="padding:10px 12px;font-family:monospace;font-size:11px;color:#38bdf8;">${s.method}</td>
          <td style="padding:10px 12px;font-family:monospace;font-size:11px;color:#cbd5e1;max-width:280px;word-break:break-all;">${escapeHtml(s.url)}</td>
          <td style="padding:10px 12px;">${statusBadge}</td>
          <td style="padding:10px 12px;font-family:monospace;font-size:12px;color:#e2e8f0;">${s.durationMs} ms</td>
          <td style="padding:10px 12px;">${assertionsHtml || '<span style="color:#64748b;font-size:11px;">No assertions</span>'}</td>
        </tr>
      `;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>HyperCurl Test Suite Report — ${escapeHtml(result.suiteName)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0b0f19; color: #f1f5f9; margin: 0; padding: 24px; }
    .container { max-width: 1100px; margin: 0 auto; }
    .header { background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
    .title { font-size: 20px; font-weight: 800; color: #f8fafc; display: flex; align-items: center; justify-content: space-between; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 16px; }
    .stat-card { background: #1e293b; padding: 12px; border-radius: 8px; text-align: center; }
    .stat-val { font-size: 22px; font-weight: 800; font-family: monospace; }
    .stat-label { font-size: 11px; text-transform: uppercase; color: #94a3b8; margin-top: 4px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden; }
    th { background: #1e293b; color: #94a3b8; text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; font-weight: 700; }
    code { background: #020617; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 11px; }
    .footer { margin-top: 24px; text-align: center; font-size: 12px; color: #64748b; font-family: monospace; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="title">
        <span>⚡ HyperCurl QA Suite Execution Report</span>
        <span style="font-size:13px;font-family:monospace;color:#94a3b8;">${dateStr}</span>
      </div>
      <div style="margin-top:6px;font-size:14px;color:#cbd5e1;">Suite: <strong>${escapeHtml(result.suiteName)}</strong> | Environment: <strong>${escapeHtml(result.environmentName || 'Default')}</strong></div>
      
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-val" style="color:#f8fafc;">${result.totalSteps}</div>
          <div class="stat-label">Total Steps</div>
        </div>
        <div class="stat-card">
          <div class="stat-val" style="color:#10b981;">${passedCount}</div>
          <div class="stat-label">Passed</div>
        </div>
        <div class="stat-card">
          <div class="stat-val" style="color:${failedCount > 0 ? '#f43f5e' : '#94a3b8'};">${failedCount}</div>
          <div class="stat-label">Failed</div>
        </div>
        <div class="stat-card">
          <div class="stat-val" style="color:#38bdf8;">${result.totalDurationMs} ms</div>
          <div class="stat-label">Total Duration</div>
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Step Name</th>
          <th>Method</th>
          <th>Target URL</th>
          <th>Status</th>
          <th>Duration</th>
          <th>Assertions Validation</th>
        </tr>
      </thead>
      <tbody>
        ${stepsRowsHtml}
      </tbody>
    </table>

    <div class="footer">
      Generated automatically by HyperCurl Engine (cURL + Autocannon)
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Generates a Markdown test execution summary.
   */
  static generateMarkdownSuiteReport(result: TestSuiteRunResult): string {
    let md = `# HyperCurl Test Suite Report — ${result.suiteName}\n\n`;
    md += `- **Date**: ${new Date(result.startTime).toISOString()}\n`;
    md += `- **Environment**: ${result.environmentName || 'Default'}\n`;
    md += `- **Total Steps**: ${result.totalSteps}\n`;
    md += `- **Passed**: ${result.passedSteps} (${result.totalSteps > 0 ? Math.round((result.passedSteps / result.totalSteps) * 100) : 0}%)\n`;
    md += `- **Failed**: ${result.failedSteps}\n`;
    md += `- **Duration**: ${result.totalDurationMs} ms\n\n`;

    md += `## Step Execution Results\n\n`;
    md += `| # | Step | Method | Status | Duration | Assertions |\n`;
    md += `|---|------|--------|--------|----------|------------|\n`;

    result.stepResults.forEach((s, idx) => {
      const assertionsSummary = s.assertions.map(a => `${a.passed ? '✓' : '✗'} ${a.type}`).join(', ') || 'None';
      md += `| ${idx + 1} | ${s.stepName} | \`${s.method}\` | **${s.status.toUpperCase()}** | ${s.durationMs}ms | ${assertionsSummary} |\n`;
    });

    return md;
  }
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
