// ============================================================
// Report Routes — Excel (.xlsx), SVG Charts, AI-generated Reports
// POST /api/report/excel   — generate .xlsx from data or AI prompt
// POST /api/report/chart   — generate SVG chart from data
// POST /api/report/generate — AI generates full report (summary + Excel + chart)
// GET  /api/report/download/:id — download a previously generated file
// ============================================================

import { Hono } from 'hono';
import * as XLSX from 'xlsx';
import type { GatewayContext } from './gateway.js';

// In-memory file store (keyed by random ID, TTL 30 min)
interface TempFile {
  name: string;
  type: string;
  data: Buffer;
  createdAt: number;
}
const tempFiles = new Map<string, TempFile>();

function storeFile(name: string, type: string, data: Buffer): string {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  tempFiles.set(id, { name, type, data, createdAt: Date.now() });
  // Cleanup files older than 30 minutes
  for (const [k, v] of tempFiles) {
    if (Date.now() - v.createdAt > 30 * 60 * 1000) tempFiles.delete(k);
  }
  return id;
}

// ─── SVG Chart generators ─────────────────────────────────

function buildBarChartSvg(labels: string[], datasets: { label: string; data: number[]; color?: string }[], title?: string): string {
  const W = 640, H = 400, PAD = { top: 50, right: 20, bottom: 80, left: 60 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const allValues = datasets.flatMap((d) => d.data);
  const maxVal = Math.max(...allValues, 1);
  const colors = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7'];

  const groupW = chartW / labels.length;
  const barW = Math.min((groupW / datasets.length) * 0.8, 40);
  const groupPad = (groupW - barW * datasets.length) / 2;

  let bars = '';
  datasets.forEach((ds, di) => {
    const color = ds.color || colors[di % colors.length];
    ds.data.forEach((val, li) => {
      const barH = (val / maxVal) * chartH;
      const x = PAD.left + li * groupW + groupPad + di * barW;
      const y = PAD.top + chartH - barH;
      bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" fill="${color}" rx="2"/>`;
      if (barH > 14) {
        bars += `<text x="${(x + barW / 2).toFixed(1)}" y="${(y - 3).toFixed(1)}" text-anchor="middle" font-size="10" fill="${color}">${val}</text>`;
      }
    });
  });

  let xLabels = labels.map((l, i) => {
    const x = PAD.left + i * groupW + groupW / 2;
    const y = PAD.top + chartH + 18;
    const truncated = l.length > 12 ? l.slice(0, 11) + '…' : l;
    return `<text x="${x.toFixed(1)}" y="${y}" text-anchor="middle" font-size="11" fill="#94a3b8">${truncated}</text>`;
  }).join('');

  // Y-axis ticks
  let yTicks = '';
  for (let i = 0; i <= 4; i++) {
    const val = (maxVal * i) / 4;
    const y = PAD.top + chartH - (val / maxVal) * chartH;
    yTicks += `<line x1="${PAD.left}" y1="${y.toFixed(1)}" x2="${PAD.left + chartW}" y2="${y.toFixed(1)}" stroke="#334155" stroke-dasharray="4,4"/>`;
    yTicks += `<text x="${PAD.left - 6}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="#94a3b8">${val % 1 === 0 ? val : val.toFixed(1)}</text>`;
  }

  // Legend
  let legend = datasets.map((ds, i) => {
    const color = ds.color || colors[i % colors.length];
    const x = PAD.left + i * 120;
    const y = H - 18;
    return `<rect x="${x}" y="${y - 8}" width="12" height="12" fill="${color}" rx="2"/><text x="${x + 16}" y="${y + 2}" font-size="11" fill="#94a3b8">${ds.label}</text>`;
  }).join('');

  const titleSvg = title ? `<text x="${W / 2}" y="28" text-anchor="middle" font-size="15" font-weight="600" fill="#e2e8f0">${title}</text>` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="background:#0f172a;border-radius:12px">
  <style>text{font-family:system-ui,sans-serif}</style>
  ${titleSvg}
  ${yTicks}
  ${bars}
  ${xLabels}
  ${legend}
  <line x1="${PAD.left}" y1="${PAD.top}" x2="${PAD.left}" y2="${PAD.top + chartH}" stroke="#475569"/>
  <line x1="${PAD.left}" y1="${PAD.top + chartH}" x2="${PAD.left + chartW}" y2="${PAD.top + chartH}" stroke="#475569"/>
</svg>`;
}

function buildLineChartSvg(labels: string[], datasets: { label: string; data: number[]; color?: string }[], title?: string): string {
  const W = 640, H = 360, PAD = { top: 50, right: 20, bottom: 70, left: 60 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const allValues = datasets.flatMap((d) => d.data);
  const maxVal = Math.max(...allValues, 1);
  const colors = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4'];

  let lines = '';
  datasets.forEach((ds, di) => {
    const color = ds.color || colors[di % colors.length];
    const pts = ds.data.map((val, i) => {
      const x = PAD.left + (i / Math.max(labels.length - 1, 1)) * chartW;
      const y = PAD.top + chartH - (val / maxVal) * chartH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    lines += `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>`;
    ds.data.forEach((val, i) => {
      const x = PAD.left + (i / Math.max(labels.length - 1, 1)) * chartW;
      const y = PAD.top + chartH - (val / maxVal) * chartH;
      lines += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${color}"/>`;
    });
  });

  const xLabels = labels.map((l, i) => {
    const x = PAD.left + (i / Math.max(labels.length - 1, 1)) * chartW;
    const truncated = l.length > 10 ? l.slice(0, 9) + '…' : l;
    return `<text x="${x.toFixed(1)}" y="${PAD.top + chartH + 18}" text-anchor="middle" font-size="11" fill="#94a3b8">${truncated}</text>`;
  }).join('');

  let yTicks = '';
  for (let i = 0; i <= 4; i++) {
    const val = (maxVal * i) / 4;
    const y = PAD.top + chartH - (val / maxVal) * chartH;
    yTicks += `<line x1="${PAD.left}" y1="${y.toFixed(1)}" x2="${PAD.left + chartW}" y2="${y.toFixed(1)}" stroke="#334155" stroke-dasharray="4,4"/>`;
    yTicks += `<text x="${PAD.left - 6}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="#94a3b8">${val % 1 === 0 ? val : val.toFixed(1)}</text>`;
  }

  const legend = datasets.map((ds, i) => {
    const color = ds.color || colors[i % colors.length];
    return `<rect x="${PAD.left + i * 120}" y="${H - 18}" width="12" height="3" fill="${color}" rx="1"/><text x="${PAD.left + i * 120 + 16}" y="${H - 10}" font-size="11" fill="#94a3b8">${ds.label}</text>`;
  }).join('');

  const titleSvg = title ? `<text x="${W / 2}" y="28" text-anchor="middle" font-size="15" font-weight="600" fill="#e2e8f0">${title}</text>` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="background:#0f172a;border-radius:12px">
  <style>text{font-family:system-ui,sans-serif}</style>
  ${titleSvg}
  ${yTicks}
  ${lines}
  ${xLabels}
  ${legend}
  <line x1="${PAD.left}" y1="${PAD.top}" x2="${PAD.left}" y2="${PAD.top + chartH}" stroke="#475569"/>
  <line x1="${PAD.left}" y1="${PAD.top + chartH}" x2="${PAD.left + chartW}" y2="${PAD.top + chartH}" stroke="#475569"/>
</svg>`;
}

function buildPieChartSvg(labels: string[], values: number[], title?: string): string {
  const W = 480, H = 360, CX = 180, CY = H / 2, R = 130;
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const colors = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#ec4899', '#14b8a6'];

  let startAngle = -Math.PI / 2;
  let slices = '';
  let legendItems = '';

  values.forEach((val, i) => {
    const angle = (val / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const x1 = CX + R * Math.cos(startAngle);
    const y1 = CY + R * Math.sin(startAngle);
    const x2 = CX + R * Math.cos(endAngle);
    const y2 = CY + R * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const color = colors[i % colors.length];
    slices += `<path d="M ${CX} ${CY} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${R} ${R} 0 ${largeArc} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z" fill="${color}" stroke="#0f172a" stroke-width="2"/>`;

    // Label in slice
    const midAngle = startAngle + angle / 2;
    const lx = CX + (R * 0.65) * Math.cos(midAngle);
    const ly = CY + (R * 0.65) * Math.sin(midAngle);
    const pct = ((val / total) * 100).toFixed(1);
    if (angle > 0.2) {
      slices += `<text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="600" fill="#fff">${pct}%</text>`;
    }

    const ly2 = 60 + i * 22;
    legendItems += `<rect x="330" y="${ly2 - 9}" width="12" height="12" fill="${color}" rx="2"/><text x="346" y="${ly2 + 1}" font-size="11" fill="#94a3b8">${labels[i]}: ${val}</text>`;

    startAngle = endAngle;
  });

  const titleSvg = title ? `<text x="${W / 2}" y="26" text-anchor="middle" font-size="15" font-weight="600" fill="#e2e8f0">${title}</text>` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="background:#0f172a;border-radius:12px">
  <style>text{font-family:system-ui,sans-serif}</style>
  ${titleSvg}
  ${slices}
  ${legendItems}
</svg>`;
}

// ─── Excel builder ────────────────────────────────────────

function buildXlsx(
  data: Record<string, unknown>[] | unknown[][],
  headers?: string[],
  sheetName = 'Sheet1',
  title?: string,
): Buffer {
  const wb = XLSX.utils.book_new();
  let ws: XLSX.WorkSheet;

  if (Array.isArray(data[0]) || !data.length) {
    // Array of arrays
    const rows = headers ? [headers, ...(data as unknown[][])] : (data as unknown[][]);
    ws = XLSX.utils.aoa_to_sheet(rows);
  } else {
    // Array of objects
    ws = XLSX.utils.json_to_sheet(data as Record<string, unknown>[], {
      header: headers,
    });
  }

  // Auto column widths
  const ref = ws['!ref'];
  if (ref) {
    const range = XLSX.utils.decode_range(ref);
    const colWidths: number[] = [];
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[addr];
        if (cell?.v != null) {
          const len = String(cell.v).length;
          colWidths[C] = Math.max(colWidths[C] || 8, Math.min(len + 2, 40));
        }
      }
    }
    ws['!cols'] = colWidths.map((w) => ({ wch: w }));
  }

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return buf;
}

// ─── AI-driven JSON extraction ────────────────────────────

function extractJsonBlock(text: string): unknown {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try { return JSON.parse(fence[1]); } catch { /* fall through */ }
  }
  const inline = text.match(/\{[\s\S]*\}/);
  if (inline) {
    try { return JSON.parse(inline[0]); } catch { /* fall through */ }
  }
  return null;
}

// ─── Route handlers ───────────────────────────────────────

export function createReportRoutes(ctx: GatewayContext) {
  const app = new Hono();

  // GET /api/report/download/:id — serve stored temp file
  app.get('/download/:id', (c) => {
    const file = tempFiles.get(c.req.param('id'));
    if (!file) return c.json({ error: 'File not found or expired (30 min TTL)' }, 404);
    return new Response(new Uint8Array(file.data), {
      headers: {
        'Content-Type': file.type,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(file.name)}"`,
        'Content-Length': String(file.data.length),
      },
    });
  });

  // POST /api/report/excel
  // Body: { data, headers?, sheetName?, title?, prompt? }
  // If `prompt` is provided, AI generates the data structure first.
  app.post('/excel', async (c) => {
    try {
      const body = await c.req.json<{
        data?: Record<string, unknown>[] | unknown[][];
        headers?: string[];
        sheetName?: string;
        title?: string;
        prompt?: string;
        fileName?: string;
      }>();

      let data = body.data;
      let headers = body.headers;
      let sheetName = body.sheetName || 'Report';
      let title = body.title;

      if (body.prompt && !data?.length) {
        // Ask AI to generate the table data
        const aiPrompt = `You are a data generator. The user wants an Excel spreadsheet.

Request: "${body.prompt}"

Respond ONLY with a JSON object in this exact format:
{
  "title": "Sheet title",
  "sheetName": "Sheet1",
  "headers": ["Column1", "Column2", ...],
  "data": [
    ["value1", "value2", ...],
    ...
  ]
}

Generate realistic, meaningful data. Include at least 5-15 rows. Use numbers where appropriate.`;

        const aiResp = await ctx.agent.chat(`report-excel-${Date.now()}`, aiPrompt);
        const parsed = extractJsonBlock(aiResp) as { title?: string; sheetName?: string; headers?: string[]; data?: unknown[][] } | null;

        if (parsed && Array.isArray(parsed.data)) {
          data = parsed.data;
          headers = headers || parsed.headers;
          sheetName = parsed.sheetName || sheetName;
          title = title || parsed.title;
        } else {
          return c.json({ error: 'AI could not generate table data. Try providing data directly.' }, 422);
        }
      }

      if (!data?.length) {
        return c.json({ error: 'data array is required (or provide a prompt)' }, 400);
      }

      const buf = buildXlsx(data, headers, sheetName, title);
      const fileName = body.fileName || `${sheetName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const fileId = storeFile(fileName, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buf);

      return c.json({
        ok: true,
        fileId,
        fileName,
        downloadUrl: `/api/report/download/${fileId}`,
        rows: Array.isArray(data) ? data.length : 0,
        cols: headers?.length ?? (Array.isArray(data[0]) ? (data[0] as unknown[]).length : Object.keys(data[0] as object).length),
      });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Excel generation failed' }, 500);
    }
  });

  // POST /api/report/chart
  // Body: { type, labels, datasets, title?, prompt? }
  app.post('/chart', async (c) => {
    try {
      const body = await c.req.json<{
        type?: 'bar' | 'line' | 'pie';
        labels?: string[];
        datasets?: { label: string; data: number[]; color?: string }[];
        values?: number[];   // for pie
        title?: string;
        prompt?: string;
        fileName?: string;
      }>();

      let chartType = body.type || 'bar';
      let labels = body.labels || [];
      let datasets = body.datasets || [];
      let values = body.values || [];
      let title = body.title;

      if (body.prompt && (!labels.length || (!datasets.length && !values.length))) {
        const aiPrompt = `You are a chart data generator. The user wants a chart.

Request: "${body.prompt}"

Respond ONLY with a JSON object:
{
  "type": "bar" | "line" | "pie",
  "title": "Chart title",
  "labels": ["label1", "label2", ...],
  "datasets": [
    { "label": "Series name", "data": [num1, num2, ...] }
  ]
}

For pie charts, use a single dataset. Generate 5-10 data points with realistic values.`;

        const aiResp = await ctx.agent.chat(`report-chart-${Date.now()}`, aiPrompt);
        const parsed = extractJsonBlock(aiResp) as { type?: string; title?: string; labels?: string[]; datasets?: { label: string; data: number[] }[] } | null;

        if (parsed && Array.isArray(parsed.labels) && Array.isArray(parsed.datasets)) {
          chartType = (parsed.type as 'bar' | 'line' | 'pie') || chartType;
          labels = parsed.labels;
          datasets = parsed.datasets;
          title = title || parsed.title;
          if (chartType === 'pie' && datasets[0]) values = datasets[0].data;
        } else {
          return c.json({ error: 'AI could not generate chart data. Try providing data directly.' }, 422);
        }
      }

      if (!labels.length) {
        return c.json({ error: 'labels are required (or provide a prompt)' }, 400);
      }

      let svg: string;
      if (chartType === 'pie') {
        const pieVals = values.length ? values : datasets[0]?.data ?? [];
        svg = buildPieChartSvg(labels, pieVals, title);
      } else if (chartType === 'line') {
        svg = buildLineChartSvg(labels, datasets, title);
      } else {
        svg = buildBarChartSvg(labels, datasets, title);
      }

      const buf = Buffer.from(svg, 'utf-8');
      const fileName = body.fileName || `chart_${chartType}_${new Date().toISOString().slice(0, 10)}.svg`;
      const fileId = storeFile(fileName, 'image/svg+xml', buf);

      return c.json({
        ok: true,
        fileId,
        fileName,
        downloadUrl: `/api/report/download/${fileId}`,
        svgInline: svg,
        type: chartType,
      });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Chart generation failed' }, 500);
    }
  });

  // POST /api/report/generate
  // Full AI report: prompt → summary text + Excel + chart SVG
  app.post('/generate', async (c) => {
    try {
      const body = await c.req.json<{
        prompt: string;
        includeExcel?: boolean;
        includeChart?: boolean;
        chartType?: 'bar' | 'line' | 'pie';
        fileName?: string;
      }>();

      if (!body.prompt?.trim()) {
        return c.json({ error: 'prompt is required' }, 400);
      }

      const includeExcel = body.includeExcel !== false;
      const includeChart = body.includeChart !== false;

      const aiPrompt = `You are a business analyst AI. The user wants a data report.

Request: "${body.prompt}"

Respond ONLY with a JSON object in this exact format:
{
  "title": "Report title",
  "summary": "2-3 paragraph executive summary of the report",
  "table": {
    "sheetName": "Data",
    "headers": ["Col1", "Col2", ...],
    "data": [["val1", "val2", ...], ...]
  },
  "chart": {
    "type": "bar",
    "title": "Chart title",
    "labels": ["label1", ...],
    "datasets": [{ "label": "Series", "data": [num, ...] }]
  },
  "insights": ["Key insight 1", "Key insight 2", "Key insight 3"]
}

Generate realistic and meaningful data with at least 8-12 rows. Make the chart data consistent with the table.`;

      const aiResp = await ctx.agent.chat(`report-gen-${Date.now()}`, aiPrompt);
      const parsed = extractJsonBlock(aiResp) as {
        title?: string;
        summary?: string;
        table?: { sheetName?: string; headers?: string[]; data?: unknown[][] };
        chart?: { type?: string; title?: string; labels?: string[]; datasets?: { label: string; data: number[] }[] };
        insights?: string[];
      } | null;

      if (!parsed) {
        return c.json({ error: 'AI could not generate report data. Try a more specific prompt.' }, 422);
      }

      const result: Record<string, unknown> = {
        ok: true,
        title: parsed.title || body.prompt,
        summary: parsed.summary || '',
        insights: parsed.insights || [],
      };

      // Generate Excel
      if (includeExcel && parsed.table?.data?.length) {
        const buf = buildXlsx(parsed.table.data, parsed.table.headers, parsed.table.sheetName || 'Data', parsed.title);
        const fileName = body.fileName
          ? body.fileName.replace(/\.xlsx$/, '') + '.xlsx'
          : `report_${new Date().toISOString().slice(0, 10)}.xlsx`;
        const fileId = storeFile(fileName, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buf);
        result.excel = {
          fileId,
          fileName,
          downloadUrl: `/api/report/download/${fileId}`,
          rows: parsed.table.data.length,
        };
      }

      // Generate Chart
      if (includeChart && parsed.chart?.labels?.length && parsed.chart?.datasets?.length) {
        const ct = (parsed.chart.type as 'bar' | 'line' | 'pie') || (body.chartType ?? 'bar');
        let svgStr: string;
        if (ct === 'pie') {
          svgStr = buildPieChartSvg(parsed.chart.labels, parsed.chart.datasets[0]?.data ?? [], parsed.chart.title);
        } else if (ct === 'line') {
          svgStr = buildLineChartSvg(parsed.chart.labels, parsed.chart.datasets, parsed.chart.title);
        } else {
          svgStr = buildBarChartSvg(parsed.chart.labels, parsed.chart.datasets, parsed.chart.title);
        }
        const chartFileName = `chart_${new Date().toISOString().slice(0, 10)}.svg`;
        const chartId = storeFile(chartFileName, 'image/svg+xml', Buffer.from(svgStr, 'utf-8'));
        result.chart = {
          fileId: chartId,
          fileName: chartFileName,
          downloadUrl: `/api/report/download/${chartId}`,
          type: ct,
          svgInline: svgStr,
        };
      }

      return c.json(result);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Report generation failed' }, 500);
    }
  });

  return app;
}
