// ─── Report Generation Skill ──────────────────────────────
// Agent tools for generating Excel files, SVG charts, and
// structured reports from natural language requests.
// Calls the gateway /api/report/* endpoints internally.
// ─────────────────────────────────────────────────────────
import { defineSkill } from '@hitechclaw/core';
function gatewayBase() {
    return process.env.GATEWAY_INTERNAL_URL || 'http://localhost:3000';
}
async function postReport(path, body) {
    const res = await fetch(`${gatewayBase()}/api/report${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const err = await res.text().catch(() => res.status.toString());
        throw new Error(`Report API${path}: ${err}`);
    }
    return res.json();
}
export const reportGenSkill = defineSkill({
    manifest: {
        id: 'report-gen',
        name: 'Report & Chart Generator',
        version: '1.0.0',
        description: 'Generate Excel spreadsheets, SVG charts (bar, line, pie), and AI-powered business reports from natural language. Supports invoice/table data generation, data visualisation, and full report packages with summary + Excel + chart.',
        author: 'HiTechClaw',
        category: 'productivity',
        tags: ['excel', 'xlsx', 'chart', 'report', 'invoice', 'visualisation', 'business'],
        tools: [],
        triggers: [],
        config: [
            {
                key: 'gatewayInternalUrl',
                label: 'Gateway Internal URL',
                type: 'string',
                description: 'Base URL of the gateway service (internal)',
                required: false,
                default: 'http://localhost:3000',
            },
        ],
    },
    tools: [
        // ── 1. Generate Excel file ───────────────────────────
        {
            definition: {
                name: 'generate_excel_report',
                description: `Generate an Excel (.xlsx) spreadsheet from a natural language description or explicit data.
Use this when the user asks to:
- Create an Excel file, spreadsheet, or table
- Export data to Excel
- Build an invoice, timesheet, budget, or any tabular document
The tool returns a download URL the user can click.`,
                category: 'productivity',
                parameters: [
                    {
                        name: 'prompt',
                        type: 'string',
                        description: 'Natural language description of what data the Excel file should contain. E.g. "Monthly sales report for Q1 2025 with product, quantity, revenue columns"',
                        required: false,
                    },
                    {
                        name: 'data',
                        type: 'array',
                        description: 'Optional: explicit 2D array of rows (array of arrays) or array of objects. If provided alongside prompt, data takes precedence.',
                        required: false,
                    },
                    {
                        name: 'headers',
                        type: 'array',
                        description: 'Optional: column header names',
                        required: false,
                    },
                    {
                        name: 'sheetName',
                        type: 'string',
                        description: 'Name of the Excel sheet (default: "Report")',
                        required: false,
                    },
                    {
                        name: 'title',
                        type: 'string',
                        description: 'Report title',
                        required: false,
                    },
                    {
                        name: 'fileName',
                        type: 'string',
                        description: 'Output file name (default: auto-generated from sheetName + date)',
                        required: false,
                    },
                ],
            },
            handler: async (args) => {
                const resp = await postReport('/excel', args);
                return {
                    status: 'success',
                    message: `✅ Excel file ready: **${resp.fileName}** (${resp.rows} rows × ${resp.cols} columns)`,
                    downloadUrl: resp.downloadUrl,
                    fileId: resp.fileId,
                    fileName: resp.fileName,
                    rows: resp.rows,
                    cols: resp.cols,
                };
            },
        },
        // ── 2. Generate SVG chart ────────────────────────────
        {
            definition: {
                name: 'generate_chart',
                description: `Generate a visual chart (bar, line, or pie) as an inline SVG image.
Use this when the user asks to:
- Draw or visualise data as a chart or graph
- Create a bar chart, line chart, pie chart
- Show data trends or comparisons visually
The SVG can be embedded directly in the chat response.`,
                category: 'productivity',
                parameters: [
                    {
                        name: 'prompt',
                        type: 'string',
                        description: 'Natural language description of the chart. E.g. "Bar chart of monthly revenue Jan-Jun 2025"',
                        required: false,
                    },
                    {
                        name: 'type',
                        type: 'string',
                        description: 'Chart type: "bar" | "line" | "pie" (default: "bar")',
                        required: false,
                    },
                    {
                        name: 'labels',
                        type: 'array',
                        description: 'X-axis labels or pie slice labels',
                        required: false,
                    },
                    {
                        name: 'datasets',
                        type: 'array',
                        description: 'Array of datasets: [{ label: string, data: number[], color?: string }]',
                        required: false,
                    },
                    {
                        name: 'values',
                        type: 'array',
                        description: 'Shorthand for single-series pie chart values (parallel to labels)',
                        required: false,
                    },
                    {
                        name: 'title',
                        type: 'string',
                        description: 'Chart title',
                        required: false,
                    },
                ],
            },
            handler: async (args) => {
                const resp = await postReport('/chart', args);
                return {
                    status: 'success',
                    message: `✅ Chart ready (${resp.type})`,
                    downloadUrl: resp.downloadUrl,
                    svgInline: resp.svgInline,
                    fileId: resp.fileId,
                    fileName: resp.fileName,
                    chartType: resp.type,
                };
            },
        },
        // ── 3. Full AI report (summary + Excel + chart) ──────
        {
            definition: {
                name: 'generate_full_report',
                description: `Generate a comprehensive AI-powered business report from a natural language request.
The report includes:
1. Executive summary (markdown)
2. Key insights / bullet points
3. Downloadable Excel spreadsheet
4. Inline SVG chart

Use this when the user asks for a "full report", "complete analysis", "business report", or mentions both Excel and charts together.`,
                category: 'productivity',
                parameters: [
                    {
                        name: 'prompt',
                        type: 'string',
                        description: 'Natural language description of the report needed. E.g. "Q1 2025 sales performance report for the APAC region"',
                        required: true,
                    },
                    {
                        name: 'includeExcel',
                        type: 'boolean',
                        description: 'Include Excel file in output (default: true)',
                        required: false,
                    },
                    {
                        name: 'includeChart',
                        type: 'boolean',
                        description: 'Include visual chart in output (default: true)',
                        required: false,
                    },
                    {
                        name: 'chartType',
                        type: 'string',
                        description: 'Preferred chart type: "bar" | "line" | "pie"',
                        required: false,
                    },
                    {
                        name: 'fileName',
                        type: 'string',
                        description: 'File name prefix for generated files',
                        required: false,
                    },
                ],
            },
            handler: async (args) => {
                var _a;
                const resp = await postReport('/generate', args);
                const parts = [
                    `## 📊 ${resp.title}`,
                    '',
                    resp.summary,
                ];
                if ((_a = resp.insights) === null || _a === void 0 ? void 0 : _a.length) {
                    parts.push('', '### Key Insights');
                    resp.insights.forEach((ins) => parts.push(`- ${ins}`));
                }
                if (resp.excel) {
                    parts.push('', `### 📥 Excel Download`, `[${resp.excel.fileName}](${resp.excel.downloadUrl}) — ${resp.excel.rows} rows`);
                }
                if (resp.chart) {
                    parts.push('', `### 📈 Chart`);
                    parts.push(resp.chart.svgInline);
                }
                return {
                    status: 'success',
                    report: parts.join('\n'),
                    title: resp.title,
                    summary: resp.summary,
                    insights: resp.insights,
                    excel: resp.excel
                        ? { downloadUrl: resp.excel.downloadUrl, fileName: resp.excel.fileName }
                        : undefined,
                    chart: resp.chart
                        ? { downloadUrl: resp.chart.downloadUrl, svgInline: resp.chart.svgInline, type: resp.chart.type }
                        : undefined,
                };
            },
        },
    ],
});
