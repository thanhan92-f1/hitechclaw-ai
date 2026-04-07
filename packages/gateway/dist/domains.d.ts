import { Hono } from 'hono';
import type { DomainPack } from '@hitechclaw/domains';
export declare function getInstalledDomainIds(): Set<string>;
export declare function createDomainRoutes(domainPacks: DomainPack[]): Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
//# sourceMappingURL=domains.d.ts.map