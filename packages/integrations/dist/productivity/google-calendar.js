import { z } from 'zod';
import { defineIntegration } from '../base/define-integration.js';
const GCAL = 'https://www.googleapis.com/calendar/v3';
async function gcalRequest(method, path, accessToken, body, params) {
    const url = new URL(`${GCAL}${path}`);
    if (params)
        for (const [k, v] of Object.entries(params))
            if (v)
                url.searchParams.set(k, v);
    const res = await fetch(url.toString(), {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Google Calendar API error ${res.status}: ${err}`);
    }
    if (res.status === 204)
        return {};
    return res.json();
}
export const googleCalendarIntegration = defineIntegration({
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Create, read, and manage calendar events',
    icon: '📅',
    category: 'productivity',
    auth: {
        type: 'oauth2',
        config: {
            authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
            tokenUrl: 'https://oauth2.googleapis.com/token',
            scopes: [
                'https://www.googleapis.com/auth/calendar',
                'https://www.googleapis.com/auth/calendar.events',
            ],
            clientIdEnv: 'GOOGLE_CLIENT_ID',
            clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
            refreshable: true,
        },
    },
    actions: [
        {
            name: 'list_events',
            description: 'List upcoming calendar events',
            parameters: z.object({
                maxResults: z.number().default(10),
                timeMin: z.string().optional().describe('Start time (ISO 8601)'),
                timeMax: z.string().optional().describe('End time (ISO 8601)'),
                calendarId: z.string().default('primary'),
            }),
            riskLevel: 'safe',
            execute: async (args, ctx) => {
                const accessToken = ctx.credentials.access_token;
                if (!accessToken)
                    return { success: false, error: 'Google Calendar access token not configured' };
                try {
                    const params = {
                        maxResults: String(args.maxResults),
                        singleEvents: 'true',
                        orderBy: 'startTime',
                    };
                    if (args.timeMin)
                        params.timeMin = args.timeMin;
                    if (args.timeMax)
                        params.timeMax = args.timeMax;
                    const data = await gcalRequest('GET', `/calendars/${encodeURIComponent(args.calendarId)}/events`, accessToken, undefined, params);
                    return { success: true, data };
                }
                catch (err) {
                    return { success: false, error: err instanceof Error ? err.message : 'Google Calendar list_events failed' };
                }
            },
        },
        {
            name: 'create_event',
            description: 'Create a new calendar event',
            parameters: z.object({
                summary: z.string().describe('Event title'),
                description: z.string().optional().describe('Event description'),
                start: z.string().describe('Start time (ISO 8601)'),
                end: z.string().describe('End time (ISO 8601)'),
                location: z.string().optional(),
                attendees: z.array(z.string().email()).optional(),
                calendarId: z.string().default('primary'),
            }),
            riskLevel: 'moderate',
            requiresApproval: true,
            execute: async (args, ctx) => {
                const accessToken = ctx.credentials.access_token;
                if (!accessToken)
                    return { success: false, error: 'Google Calendar access token not configured' };
                try {
                    const body = {
                        summary: args.summary,
                        start: { dateTime: args.start },
                        end: { dateTime: args.end },
                    };
                    if (args.description)
                        body.description = args.description;
                    if (args.location)
                        body.location = args.location;
                    if (args.attendees?.length)
                        body.attendees = args.attendees.map((email) => ({ email }));
                    const data = await gcalRequest('POST', `/calendars/${encodeURIComponent(args.calendarId)}/events`, accessToken, body);
                    return { success: true, data };
                }
                catch (err) {
                    return { success: false, error: err instanceof Error ? err.message : 'Google Calendar create_event failed' };
                }
            },
        },
        {
            name: 'delete_event',
            description: 'Delete a calendar event',
            parameters: z.object({
                eventId: z.string().describe('Event ID to delete'),
                calendarId: z.string().default('primary'),
            }),
            riskLevel: 'dangerous',
            requiresApproval: true,
            execute: async (args, ctx) => {
                const accessToken = ctx.credentials.access_token;
                if (!accessToken)
                    return { success: false, error: 'Google Calendar access token not configured' };
                try {
                    await gcalRequest('DELETE', `/calendars/${encodeURIComponent(args.calendarId)}/events/${args.eventId}`, accessToken);
                    return { success: true, data: { deleted: true, eventId: args.eventId } };
                }
                catch (err) {
                    return { success: false, error: err instanceof Error ? err.message : 'Google Calendar delete_event failed' };
                }
            },
        },
    ],
    triggers: [
        {
            name: 'event_starting_soon',
            description: 'Fires when a calendar event is starting soon (default: 15 min)',
            eventSchema: z.object({
                eventId: z.string(),
                summary: z.string(),
                start: z.string(),
                minutesUntilStart: z.number(),
            }),
            pollInterval: 60_000,
            poll: async (lastPollTime, credentials) => {
                const accessToken = credentials.access_token;
                if (!accessToken)
                    return [];
                try {
                    const now = new Date();
                    const lookAheadMs = 15 * 60 * 1000;
                    const params = {
                        maxResults: '10',
                        singleEvents: 'true',
                        orderBy: 'startTime',
                        timeMin: now.toISOString(),
                        timeMax: new Date(now.getTime() + lookAheadMs).toISOString(),
                    };
                    const data = await gcalRequest('GET', '/calendars/primary/events', accessToken, undefined, params);
                    const items = data.items ?? [];
                    return items.map(event => ({
                        integrationId: 'google-calendar',
                        triggerName: 'event_starting_soon',
                        data: {
                            eventId: event.id,
                            summary: event.summary ?? '(No title)',
                            start: (event.start?.dateTime ?? event.start?.date) ?? '',
                            minutesUntilStart: Math.round((new Date((event.start?.dateTime ?? '') || now.toISOString()).getTime() - now.getTime()) / 60000),
                        },
                        timestamp: new Date(),
                    }));
                }
                catch {
                    return [];
                }
            },
        },
    ],
});
//# sourceMappingURL=google-calendar.js.map