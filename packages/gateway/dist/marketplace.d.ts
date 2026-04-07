import { Hono } from 'hono';
import type { DomainPack } from '@hitechclaw/domains';
export interface MarketplaceItem {
    id: string;
    name: string;
    description: string;
    version: string;
    author: string;
    category: string;
    rating: number;
    downloads: number;
    installed: boolean;
    icon: string;
    tags: string[];
    domainId: string;
}
export declare function createMarketplaceRoutes(domainPacks: DomainPack[]): Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
//# sourceMappingURL=marketplace.d.ts.map