// ============================================================
// @hitechclaw/chat-sdk/react — React Context & Provider
// ============================================================

import { createContext, useContext, useMemo, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { HiTechClawClient } from '../client.js';
import type { HiTechClawConfig } from '../types.js';

const HiTechClawContext = createContext<HiTechClawClient | null>(null);

export interface HiTechClawProviderProps {
    config: HiTechClawConfig;
    children: ReactNode;
}

/** Provider that makes HiTechClawClient available to all child hooks */
export function HiTechClawProvider({ config, children }: HiTechClawProviderProps) {
    const clientRef = useRef<HiTechClawClient | null>(null);

    const client = useMemo(() => {
        clientRef.current = new HiTechClawClient(config);
        return clientRef.current;
    }, [config.baseUrl, config.token]);

    // Sync token changes without recreating client
    useEffect(() => {
        if (config.token && clientRef.current) {
            clientRef.current.setToken(config.token);
        }
    }, [config.token]);

    return (
        <HiTechClawContext value={client}>
            {children}
        </HiTechClawContext>
    );
}

/** Get the HiTechClawClient from context */
export function useHiTechClawClient(): HiTechClawClient {
    const client = useContext(HiTechClawContext);
    if (!client) {
        throw new Error('useHiTechClawClient must be used within <HiTechClawProvider>');
    }
    return client;
}
