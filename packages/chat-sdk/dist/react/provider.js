import { jsx as _jsx } from "react/jsx-runtime";
// ============================================================
// @hitechclaw/chat-sdk/react — React Context & Provider
// ============================================================
import { createContext, useContext, useMemo, useRef, useEffect } from 'react';
import { HiTechClawClient } from '../client.js';
const HiTechClawContext = createContext(null);
/** Provider that makes HiTechClawClient available to all child hooks */
export function HiTechClawProvider({ config, children }) {
    const clientRef = useRef(null);
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
    return (_jsx(HiTechClawContext, { value: client, children: children }));
}
/** Get the HiTechClawClient from context */
export function useHiTechClawClient() {
    const client = useContext(HiTechClawContext);
    if (!client) {
        throw new Error('useHiTechClawClient must be used within <HiTechClawProvider>');
    }
    return client;
}
//# sourceMappingURL=provider.js.map