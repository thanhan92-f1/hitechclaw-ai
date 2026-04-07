import type { SkillManifest, ToolDefinition } from '@hitechclaw/shared';
import type { ToolHandler } from '../tools/tool-registry.js';
export interface SkillDefinition {
    manifest: SkillManifest;
    tools: Array<{
        definition: ToolDefinition;
        handler: ToolHandler;
    }>;
    activate?: () => Promise<void>;
    deactivate?: () => Promise<void>;
}
/** Interface for pluggable skill selection strategies (e.g. BanditSelector from @hitechclaw/ml) */
export interface SkillSelector {
    addArm(armId: string): void;
    removeArm(armId: string): void;
    select(availableArms?: string[]): string;
    reward(signal: {
        armId: string;
        reward: number;
        source: string;
        timestamp: Date;
    }): void;
    getRanking(): Array<{
        armId: string;
        stats: {
            meanReward: number;
            pulls: number;
        };
    }>;
}
export declare function defineSkill(skill: SkillDefinition): SkillDefinition;
export declare class SkillManager {
    private skills;
    private activeSkills;
    private selector;
    /** Attach a bandit/RL selector for intelligent skill ranking */
    setSelector(selector: SkillSelector): void;
    getSelector(): SkillSelector | null;
    register(skill: SkillDefinition): void;
    activate(name: string): Promise<void>;
    deactivate(name: string): Promise<void>;
    getActiveTools(): Array<{
        definition: ToolDefinition;
        handler: ToolHandler;
    }>;
    /**
     * Select the best skill from active skills using the RL selector.
     * Falls back to the first active skill if no selector is attached.
     */
    selectBestSkill(): string | undefined;
    /**
     * Get active tools ordered by skill ranking from the RL selector.
     * Skills with higher reward get their tools listed first.
     */
    getRankedTools(): Array<{
        definition: ToolDefinition;
        handler: ToolHandler;
        skillName: string;
    }>;
    /** Send a reward signal for a skill (from user feedback or tool success) */
    rewardSkill(skillName: string, reward: number, source?: 'user-feedback' | 'tool-success' | 'latency' | 'composite'): void;
    getSkill(name: string): SkillDefinition | undefined;
    listSkills(): SkillManifest[];
    isActive(name: string): boolean;
}
//# sourceMappingURL=skill-manager.d.ts.map