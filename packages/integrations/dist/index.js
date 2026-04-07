// @hitechclaw/integrations — Integration Layer
// Connect AI agents to external services
export { defineIntegration } from './base/define-integration.js';
export { IntegrationRegistry } from './base/registry.js';
// ─── Built-in Integrations ─────────────────────────────────
export { allIntegrations } from './all.js';
export { gmailIntegration } from './email/gmail.js';
export { googleCalendarIntegration } from './productivity/google-calendar.js';
export { notionIntegration } from './productivity/notion.js';
export { githubIntegration } from './developer/github.js';
export { telegramApiIntegration } from './messaging/telegram-api.js';
export { slackApiIntegration } from './messaging/slack-api.js';
export { imessageIntegration } from './messaging/imessage.js';
export { braveSearchIntegration } from './search/brave-search.js';
export { tavilySearchIntegration, tavilyWebSearch } from './search/tavily-search.js';
export { huggingfaceIntegration } from './ai/huggingface.js';
export { wandbIntegration } from './ai/wandb.js';
