import type { ReactNode } from 'react';
import { HiTechClawClient } from '../client.js';
import type { HiTechClawConfig } from '../types.js';
export interface HiTechClawProviderProps {
    config: HiTechClawConfig;
    children: ReactNode;
}
/** Provider that makes HiTechClawClient available to all child hooks */
export declare function HiTechClawProvider({ config, children }: HiTechClawProviderProps): import("react/jsx-runtime").JSX.Element;
/** Get the HiTechClawClient from context */
export declare function useHiTechClawClient(): HiTechClawClient;
//# sourceMappingURL=provider.d.ts.map