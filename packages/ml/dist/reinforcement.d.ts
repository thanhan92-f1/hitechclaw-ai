/**
 * @hitechclaw/ml — Reinforcement Learning: Multi-Armed Bandit
 *
 * Strategies: Epsilon-Greedy, UCB1, Thompson Sampling
 * Use case: skill/tool selection based on user feedback & tool success rates.
 */
import type { ArmStats, BanditConfig, BanditState, RewardSignal } from './types.js';
export declare class BanditSelector {
    private state;
    constructor(id: string, config?: Partial<BanditConfig>);
    /** Register an arm (skill/tool). Idempotent. */
    addArm(armId: string): void;
    /** Remove an arm */
    removeArm(armId: string): void;
    /** Select the best arm based on the configured strategy */
    select(availableArms?: string[]): string;
    /** Record a reward for an arm */
    reward(signal: RewardSignal): void;
    /** Get ranking of all arms by mean reward (descending) */
    getRanking(): Array<{
        armId: string;
        stats: ArmStats;
    }>;
    /** Get stats for a specific arm */
    getArmStats(armId: string): ArmStats | undefined;
    /** Export full state (for persistence to MongoDB) */
    getState(): BanditState;
    /** Restore state from persistence */
    loadState(state: BanditState): void;
    private selectEpsilonGreedy;
    private selectUCB1;
    private selectThompsonSampling;
    private bestMeanArm;
}
//# sourceMappingURL=reinforcement.d.ts.map