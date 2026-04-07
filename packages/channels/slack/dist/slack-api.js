/**
 * Slack Web API wrapper — minimal implementation for HiTechClaw channel plugin.
 * Uses plain HTTP calls to avoid heavy SDK dependencies.
 */
export class SlackApi {
    botToken;
    baseUrl = 'https://slack.com/api';
    constructor(botToken) {
        this.botToken = botToken;
    }
    async call(method, body) {
        const res = await fetch(`${this.baseUrl}/${method}`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.botToken}`,
                'Content-Type': 'application/json; charset=utf-8',
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        const data = await res.json();
        if (!data.ok)
            throw new Error(`Slack API error: ${data.error}`);
        return data;
    }
    async authTest() {
        return this.call('auth.test');
    }
    async postMessage(channel, text, threadTs) {
        await this.call('chat.postMessage', { channel, text, thread_ts: threadTs });
    }
    async conversationsHistory(channel, limit = 10) {
        const data = await this.call('conversations.history', { channel, limit });
        return data.messages || [];
    }
}
//# sourceMappingURL=slack-api.js.map