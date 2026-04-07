const DEFAULT_EPSILON = 0.1;
const DEFAULT_EPSILON_DECAY = 0.999;
const DEFAULT_EPSILON_MIN = 0.01;
const DEFAULT_EXPLORATION_CONSTANT = Math.SQRT2;
function createArmStats() {
    return { pulls: 0, totalReward: 0, meanReward: 0, sumSquaredReward: 0, alpha: 1, beta: 1 };
}
// ─── Sampling Helpers ───────────────────────────────────────
/** Sample from Beta distribution using Jöhnk's algorithm */
function sampleBeta(alpha, beta) {
    // Use inverse transform for simple cases
    if (alpha === 1 && beta === 1)
        return Math.random();
    // Gamma-based sampling: Beta(a,b) = G(a) / (G(a) + G(b))
    const ga = sampleGamma(alpha);
    const gb = sampleGamma(beta);
    return ga / (ga + gb);
}
/** Sample from Gamma distribution (Marsaglia & Tsang's method) */
function sampleGamma(shape) {
    if (shape < 1) {
        return sampleGamma(shape + 1) * Math.pow(Math.random(), 1 / shape);
    }
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (;;) {
        let x, v;
        do {
            x = randomNormal();
            v = 1 + c * x;
        } while (v <= 0);
        v = v * v * v;
        const u = Math.random();
        if (u < 1 - 0.0331 * (x * x) * (x * x))
            return d * v;
        if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v)))
            return d * v;
    }
}
/** Box-Muller transform for standard normal */
function randomNormal() {
    const u = 1 - Math.random();
    const v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
// ─── Bandit Selector ────────────────────────────────────────
export class BanditSelector {
    state;
    constructor(id, config) {
        this.state = {
            id,
            config: {
                strategy: config?.strategy ?? 'ucb1',
                epsilon: config?.epsilon ?? DEFAULT_EPSILON,
                explorationConstant: config?.explorationConstant ?? DEFAULT_EXPLORATION_CONSTANT,
                epsilonDecay: config?.epsilonDecay ?? DEFAULT_EPSILON_DECAY,
                epsilonMin: config?.epsilonMin ?? DEFAULT_EPSILON_MIN,
            },
            arms: {},
            totalPulls: 0,
            currentEpsilon: config?.epsilon ?? DEFAULT_EPSILON,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    }
    /** Register an arm (skill/tool). Idempotent. */
    addArm(armId) {
        if (!this.state.arms[armId]) {
            this.state.arms[armId] = createArmStats();
        }
    }
    /** Remove an arm */
    removeArm(armId) {
        delete this.state.arms[armId];
    }
    /** Select the best arm based on the configured strategy */
    select(availableArms) {
        const armIds = availableArms ?? Object.keys(this.state.arms);
        if (armIds.length === 0)
            throw new Error('No arms available for selection');
        if (armIds.length === 1)
            return armIds[0];
        // Ensure all arms are registered
        for (const id of armIds)
            this.addArm(id);
        // Arms that have never been pulled get priority (exploration)
        const unexplored = armIds.filter((id) => this.state.arms[id].pulls === 0);
        if (unexplored.length > 0) {
            return unexplored[Math.floor(Math.random() * unexplored.length)];
        }
        switch (this.state.config.strategy) {
            case 'epsilon-greedy':
                return this.selectEpsilonGreedy(armIds);
            case 'ucb1':
                return this.selectUCB1(armIds);
            case 'thompson-sampling':
                return this.selectThompsonSampling(armIds);
            default:
                return this.selectUCB1(armIds);
        }
    }
    /** Record a reward for an arm */
    reward(signal) {
        const arm = this.state.arms[signal.armId];
        if (!arm) {
            this.addArm(signal.armId);
            this.reward(signal);
            return;
        }
        const r = Math.max(0, Math.min(1, signal.reward)); // clamp to [0, 1]
        arm.pulls += 1;
        arm.totalReward += r;
        arm.meanReward = arm.totalReward / arm.pulls;
        arm.sumSquaredReward += r * r;
        arm.lastSelectedAt = signal.timestamp;
        // Update Beta distribution parameters for Thompson Sampling
        arm.alpha += r;
        arm.beta += 1 - r;
        this.state.totalPulls += 1;
        this.state.updatedAt = new Date();
        // Decay epsilon
        if (this.state.config.strategy === 'epsilon-greedy') {
            const decay = this.state.config.epsilonDecay ?? DEFAULT_EPSILON_DECAY;
            const min = this.state.config.epsilonMin ?? DEFAULT_EPSILON_MIN;
            this.state.currentEpsilon = Math.max(min, this.state.currentEpsilon * decay);
        }
    }
    /** Get ranking of all arms by mean reward (descending) */
    getRanking() {
        return Object.entries(this.state.arms)
            .map(([armId, stats]) => ({ armId, stats }))
            .sort((a, b) => b.stats.meanReward - a.stats.meanReward);
    }
    /** Get stats for a specific arm */
    getArmStats(armId) {
        return this.state.arms[armId];
    }
    /** Export full state (for persistence to MongoDB) */
    getState() {
        return structuredClone(this.state);
    }
    /** Restore state from persistence */
    loadState(state) {
        this.state = structuredClone(state);
    }
    // ─── Strategy Implementations ─────────────────────────────
    selectEpsilonGreedy(armIds) {
        if (Math.random() < this.state.currentEpsilon) {
            // Explore: random arm
            return armIds[Math.floor(Math.random() * armIds.length)];
        }
        // Exploit: best known arm
        return this.bestMeanArm(armIds);
    }
    selectUCB1(armIds) {
        const c = this.state.config.explorationConstant ?? DEFAULT_EXPLORATION_CONSTANT;
        const totalPulls = this.state.totalPulls;
        const logTotal = Math.log(totalPulls);
        let bestArm = armIds[0];
        let bestScore = -Infinity;
        for (const id of armIds) {
            const arm = this.state.arms[id];
            // UCB1 = meanReward + c * sqrt(ln(totalPulls) / armPulls)
            const exploitation = arm.meanReward;
            const exploration = c * Math.sqrt(logTotal / arm.pulls);
            const score = exploitation + exploration;
            if (score > bestScore) {
                bestScore = score;
                bestArm = id;
            }
        }
        return bestArm;
    }
    selectThompsonSampling(armIds) {
        let bestArm = armIds[0];
        let bestSample = -Infinity;
        for (const id of armIds) {
            const arm = this.state.arms[id];
            const sample = sampleBeta(arm.alpha, arm.beta);
            if (sample > bestSample) {
                bestSample = sample;
                bestArm = id;
            }
        }
        return bestArm;
    }
    bestMeanArm(armIds) {
        let bestArm = armIds[0];
        let bestMean = -Infinity;
        for (const id of armIds) {
            const arm = this.state.arms[id];
            if (arm.meanReward > bestMean) {
                bestMean = arm.meanReward;
                bestArm = id;
            }
        }
        return bestArm;
    }
}
//# sourceMappingURL=reinforcement.js.map