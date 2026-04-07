import { gmailIntegration } from './email/gmail.js';
import { googleCalendarIntegration } from './productivity/google-calendar.js';
import { notionIntegration } from './productivity/notion.js';
import { githubIntegration } from './developer/github.js';
import { telegramApiIntegration } from './messaging/telegram-api.js';
import { slackApiIntegration } from './messaging/slack-api.js';
import { imessageIntegration } from './messaging/imessage.js';
import { braveSearchIntegration } from './search/brave-search.js';
import { tavilySearchIntegration } from './search/tavily-search.js';
import { huggingfaceIntegration } from './ai/huggingface.js';
import { wandbIntegration } from './ai/wandb.js';
/**
 * All built-in integrations.
 * Register all at once: registry.registerAll(allIntegrations)
 */
export const allIntegrations = [
    // Email
    gmailIntegration,
    // Productivity
    googleCalendarIntegration,
    notionIntegration,
    // Developer
    githubIntegration,
    // Messaging
    telegramApiIntegration,
    slackApiIntegration,
    imessageIntegration,
    // Search
    braveSearchIntegration,
    tavilySearchIntegration,
    // AI / ML
    huggingfaceIntegration,
    wandbIntegration,
];
