// Builds and downloads the "Progress Summary" PDF — a monthly, AI-narrated
// report of a client's body-measurement progress since they started, with
// simple inline SVG trend charts. Same HTML-string + html2canvas + jsPDF
// pattern as dietPlanPdf.ts, so it renders identically whether opened from
// PMS (this file) or the PWA (client-wellness-portal-main's copy of this
// file — kept in sync by hand since the two apps don't share a package).
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  fetchProgressSummaryData,
  fetchProgressInsightsNarrative,
  CHART_METRIC_KEYS,
  type MetricTrend,
  type ProgressSummaryData,
} from './progressSummary';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function monthsBetween(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  const start = new Date(a);
  const end = new Date(b);
  return Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
}

// -----------------------------------------------------------------------
// Deterministic fallback narrative — used when the AI edge function isn't
// available (no OpenAI credits, network down, etc.) so the report always
// has an insights section, not just a blank space.
// -----------------------------------------------------------------------
function buildFallbackNarrative(data: ProgressSummaryData): string {
  const trended = data.metrics.filter((m) => m.hasTrend);
  if (trended.length === 0) {
    return data.entryCount <= 1
      ? `Only one measurement has been logged so far (${formatDate(data.latestDate)}). Keep logging regularly to start seeing trends here.`
      : `Measurements have been logged, but not enough of the same metrics repeat yet to show a trend. Keep logging regularly to start seeing trends here.`;
  }
  const improved = trended.filter((m) => m.improved);
  const worsened = trended.filter((m) => !m.improved && m.change !== 0);
  const highlight = [...improved].sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange))[0];

  const parts: string[] = [];
  if (highlight) {
    parts.push(
      `${data.clientName}'s ${highlight.label.toLowerCase()} has ${highlight.change < 0 ? 'reduced' : 'increased'} by ${Math.abs(highlight.change)}${highlight.unit} (${Math.abs(highlight.pctChange)}%) since ${formatDate(data.sinceDate)}.`,
    );
  }
  if (improved.length > 1) {
    parts.push(`${improved.length} of ${trended.length} tracked metrics are trending in the right direction.`);
  }
  if (worsened.length > 0) {
    parts.push(`${worsened.length === 1 ? 'One metric hasn\'t' : `${worsened.length} metrics haven't`} moved in the target direction yet — worth a check-in.`);
  }
  parts.push('Keep up the consistent tracking — steady logging makes trends like these easy to see.');
  return parts.join(' ');
}

// -----------------------------------------------------------------------
// Minimal hand-rolled SVG line chart (no chart library) — renders reliably
// via html2canvas since it's just static markup, same approach the rest of
// this file's HTML-string PDFs already rely on.
// -----------------------------------------------------------------------
function buildLineChartSvg(trend: MetricTrend): string {
  const W = 700;
  const H = 220;
  const pad = { top: 16, right: 24, bottom: 34, left: 50 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const values = trend.series.map((p) => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  } else {
    const spread = max - min;
    min -= spread * 0.1;
    max += spread * 0.1;
  }

  const xFor = (i: number) =>
    trend.series.length === 1
      ? pad.left + innerW / 2
      : pad.left + (i / (trend.series.length - 1)) * innerW;
  const yFor = (v: number) => pad.top + innerH - ((v - min) / (max - min)) * innerH;

  const points = trend.series.map((p, i) => ({ x: xFor(i), y: yFor(p.value), v: p.value, d: p.date }));
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const gridLines = [0, 0.5, 1].map((t) => {
    const y = pad.top + innerH * t;
    const val = round(max - (max - min) * t, trend.unit);
    return `
      <line x1="${pad.left}" y1="${y.toFixed(1)}" x2="${W - pad.right}" y2="${y.toFixed(1)}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3,3" />
      <text x="${pad.left - 8}" y="${(y + 3).toFixed(1)}" font-size="10" fill="#64748b" text-anchor="end">${val}${trend.unit}</text>
    `;
  }).join('');

  const dots = points.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="#FF4D06" />`).join('');

  return `
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      ${gridLines}
      <path d="${pathD}" fill="none" stroke="#FF4D06" stroke-width="2.5" />
      ${dots}
      <text x="${pad.left}" y="${H - 8}" font-size="10" fill="#64748b" text-anchor="start">${formatDate(points[0]?.d)}</text>
      <text x="${W - pad.right}" y="${H - 8}" font-size="10" fill="#64748b" text-anchor="end">${formatDate(points[points.length - 1]?.d)}</text>
    </svg>
  `;
}

function round(v: number, unit: string): number {
  return unit === '' || unit === '%' ? Math.round(v * 10) / 10 : Math.round(v);
}

function deltaBadge(m: MetricTrend): string {
  if (!m.hasTrend) return `<span style="font-size:10px;color:#94a3b8;">First entry</span>`;
  const sign = m.change > 0 ? '+' : '';
  const color = m.change === 0 ? '#64748b' : m.improved ? '#16a34a' : '#dc2626';
  return `<span style="font-size:11px;font-weight:600;color:${color};">${sign}${m.change}${m.unit} (${sign}${m.pctChange}%)</span>`;
}

function buildStatCard(m: MetricTrend): string {
  return `
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;">
      <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.03em;margin-bottom:4px;">${m.label}</div>
      <div style="font-size:18px;font-weight:700;color:#1e293b;">${m.latest}${m.unit}</div>
      <div style="margin-top:2px;">${deltaBadge(m)}</div>
    </div>
  `;
}

function buildHtml(data: ProgressSummaryData, narrative: string, logoDataUrl: string): string {
  const chartMetrics = data.metrics.filter((m) => CHART_METRIC_KEYS.includes(m.key) && m.hasTrend);
  const months = monthsBetween(data.sinceDate, data.latestDate);
  const periodLabel = months > 0 ? `${months} month${months === 1 ? '' : 's'}` : 'less than a month';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Progress Summary - ${data.clientName}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;padding:25px 35px;color:#334155;font-size:11px;line-height:1.4}
  .header{text-align:center;margin-bottom:20px;border-bottom:2px solid #FF4D06;padding-bottom:15px}
  .header img{width:70px;height:auto;margin-bottom:8px}
  .header h1{color:#FF4D06;font-size:20px;margin-bottom:4px}
  .header p{color:#64748b;font-size:12px}
  .meta{display:flex;justify-content:center;gap:24px;margin-top:8px;font-size:10px;color:#64748b}
  .section-title{color:#FF4D06;font-size:14px;font-weight:700;margin:22px 0 10px;border-bottom:1px solid #FED7AA;padding-bottom:5px}
  .insights{background:#FFF7ED;border-left:4px solid #FF4D06;border-radius:8px;padding:14px 16px;font-size:11.5px;color:#334155}
  .stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
  table{width:100%;border-collapse:collapse;font-size:10px;margin-top:6px}
  th{background:#FF4D06;color:white;padding:7px;text-align:left;font-weight:600}
  td{padding:7px;border-bottom:1px solid #e2e8f0}
  tr:nth-child(even){background:#f8fafc}
  .chart-block{margin-bottom:14px;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px}
  .chart-block h4{font-size:11px;color:#334155;margin-bottom:4px}
  .footer{text-align:center;margin-top:26px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:9px;color:#94a3b8}
</style>
</head>
<body>
  <div class="header">
    ${logoDataUrl ? `<img src="${logoDataUrl}" alt="Fitsush"/>` : ''}
    <h1>Progress Summary</h1>
    <p>${data.clientName}${data.goal ? ` &middot; Goal: ${data.goal}` : ''}</p>
    <div class="meta">
      <span>Since: ${formatDate(data.sinceDate)}</span>
      <span>Latest: ${formatDate(data.latestDate)}</span>
      <span>${periodLabel} tracked &middot; ${data.entryCount} entr${data.entryCount === 1 ? 'y' : 'ies'}</span>
    </div>
  </div>

  <h3 class="section-title">✨ Insights</h3>
  <div class="insights">${narrative}</div>

  ${data.metrics.length > 0 ? `
  <h3 class="section-title">Latest Snapshot</h3>
  <div class="stat-grid">
    ${data.metrics.map(buildStatCard).join('')}
  </div>` : ''}

  ${chartMetrics.length > 0 ? `
  <h3 class="section-title">Trends</h3>
  ${chartMetrics.map((m) => `
    <div class="chart-block">
      <h4>${m.label} ${m.unit ? `(${m.unit})` : ''}</h4>
      ${buildLineChartSvg(m)}
    </div>
  `).join('')}` : ''}

  ${data.metrics.length > 0 ? `
  <h3 class="section-title">Full History (First vs Latest)</h3>
  <table>
    <thead><tr><th>Metric</th><th>First</th><th>Latest</th><th>Change</th></tr></thead>
    <tbody>
      ${data.metrics.map((m) => `
        <tr>
          <td>${m.label}</td>
          <td>${m.first}${m.unit}</td>
          <td>${m.latest}${m.unit}</td>
          <td>${m.hasTrend ? `${m.change > 0 ? '+' : ''}${m.change}${m.unit} (${m.change > 0 ? '+' : ''}${m.pctChange}%)` : '—'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>` : `
  <p style="margin-top:16px;color:#64748b;">No body measurements have been logged yet — once entries are added, this report will show trends since ${formatDate(data.sinceDate)}.</p>
  `}

  <div class="footer">© ${new Date().getFullYear()} Fitsush &middot; Generated ${formatDate(new Date().toISOString())} &middot; AI-assisted summary, not medical advice.</div>
</body>
</html>`;
}

async function fetchLogoDataUrl(): Promise<string> {
  try {
    const res = await fetch('/fitsush-logo.webp');
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

async function renderHtmlToPdf(html: string, filename: string): Promise<void> {
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:white;z-index:-1;';
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, { scale: 2, useCORS: true, logging: false, width: 794 });

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const ratio = canvas.width / pageW;
    const totalPdfH = canvas.height / ratio;

    let yOffset = 0;
    let firstPage = true;
    while (yOffset < totalPdfH) {
      if (!firstPage) pdf.addPage();
      firstPage = false;

      const sliceH = Math.min(pageH, totalPdfH - yOffset) * ratio;
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceH;
      const ctx = sliceCanvas.getContext('2d')!;
      ctx.drawImage(canvas, 0, yOffset * ratio, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      pdf.addImage(sliceCanvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, sliceH / ratio);
      yOffset += pageH;
    }

    pdf.save(filename);
  } finally {
    document.body.removeChild(container);
  }
}

export async function downloadProgressSummaryPdf(clientId: string): Promise<void> {
  const data = await fetchProgressSummaryData(clientId);
  const ai = await fetchProgressInsightsNarrative(data);
  const narrative = ai?.narrative?.trim() || buildFallbackNarrative(data);
  const logoDataUrl = await fetchLogoDataUrl();
  const html = buildHtml(data, narrative, logoDataUrl);
  const safeName = data.clientName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  await renderHtmlToPdf(html, `progress-summary-${safeName}.pdf`);
}
