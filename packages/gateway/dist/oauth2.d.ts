import { Hono } from 'hono';
import type { GatewayContext } from './gateway.js';
export interface OAuth2ProviderConfig {
    clientId: string;
    clientSecret: string;
    authorizeUrl: string;
    tokenUrl: string;
    userInfoUrl: string;
    scopes: string[];
    mapProfile: (profile: Record<string, any>) => {
        providerAccountId: string;
        email: string;
        name: string;
        avatarUrl?: string;
    };
}
export declare function createOAuth2Routes(ctx: GatewayContext): Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
//# sourceMappingURL=oauth2.d.ts.map