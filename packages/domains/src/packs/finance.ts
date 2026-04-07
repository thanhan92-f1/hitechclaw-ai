import { defineDomainPack } from '../base/domain-pack.js';

export const financeDomain = defineDomainPack({
  id: 'finance',
  name: 'Finance & Accounting',
  description: 'Financial analysis, budgeting, tax calculations, invoice processing, and financial reporting.',
  icon: '💰',
  skills: [
    {
      id: 'financial-analysis',
      name: 'Financial Analysis',
      description: 'Analyze financial data, calculate ratios, and generate reports.',
      version: '1.0.0',
      category: 'finance',
      tools: [
        {
          name: 'calculate_financial_ratios',
          description: 'Calculate common financial ratios from financial statement data.',
          parameters: {
            type: 'object',
            properties: {
              revenue: { type: 'number' },
              netIncome: { type: 'number' },
              totalAssets: { type: 'number' },
              totalLiabilities: { type: 'number' },
              currentAssets: { type: 'number' },
              currentLiabilities: { type: 'number' },
            },
            required: ['revenue', 'netIncome'],
          },
          execute: async (params: any) => {
            const ratios: Record<string, number | string> = {};
            if (params.revenue > 0) ratios.profitMargin = `${((params.netIncome / params.revenue) * 100).toFixed(2)}%`;
            if (params.totalAssets) ratios.roa = `${((params.netIncome / params.totalAssets) * 100).toFixed(2)}%`;
            if (params.currentLiabilities) ratios.currentRatio = (params.currentAssets / params.currentLiabilities).toFixed(2);
            if (params.totalAssets && params.totalLiabilities) ratios.debtToAsset = `${((params.totalLiabilities / params.totalAssets) * 100).toFixed(2)}%`;
            return { success: true, data: ratios };
          },
        },
      ],
    },
    {
      id: 'invoice-processing',
      name: 'Invoice Processing',
      description: 'Extract data from invoices and generate invoice documents.',
      version: '1.0.0',
      category: 'finance',
      tools: [
        {
          name: 'parse_invoice',
          description: 'Extract structured data from invoice text.',
          parameters: {
            type: 'object',
            properties: {
              text: { type: 'string', description: 'Raw invoice text' },
            },
            required: ['text'],
          },
          execute: async (params: any) => ({
            success: true,
            data: { _llmTool: true, toolPrompt: `Extract structured data from this invoice text. Identify: vendor/company name, invoice number, date, due date, line items (description, quantity, unit price, total), subtotal, tax, and total amount. Format as a structured table:\n\n${params.text}` },
          }),
        },
      ],
    },
  ],
  agentPersona: `You are HiTechClaw Finance, an AI assistant specializing in financial analysis, accounting, and business finance. You help with financial modeling, ratio analysis, budgeting, tax planning, and financial reporting.

Always be precise with numbers. Show your calculations step by step. Include relevant caveats about tax regulations varying by jurisdiction. When dealing with investments, include risk disclaimers.`,
  recommendedIntegrations: ['google-calendar', 'notion', 'gmail'],
});
