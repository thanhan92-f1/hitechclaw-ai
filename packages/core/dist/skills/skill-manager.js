export function defineSkill(skill) {
    return skill;
}
export class SkillManager {
    skills = new Map();
    activeSkills = new Set();
    selector = null;
    /** Attach a bandit/RL selector for intelligent skill ranking */
    setSelector(selector) {
        this.selector = selector;
        // Register all existing skills as arms
        for (const name of this.skills.keys()) {
            selector.addArm(name);
        }
    }
    getSelector() {
        return this.selector;
    }
    register(skill) {
        this.skills.set(skill.manifest.name, skill);
        this.selector?.addArm(skill.manifest.name);
    }
    async activate(name) {
        const skill = this.skills.get(name);
        if (!skill)
            throw new Error(`Skill "${name}" not found`);
        if (this.activeSkills.has(name))
            return;
        if (skill.activate)
            await skill.activate();
        this.activeSkills.add(name);
    }
    async deactivate(name) {
        const skill = this.skills.get(name);
        if (!skill || !this.activeSkills.has(name))
            return;
        if (skill.deactivate)
            await skill.deactivate();
        this.activeSkills.delete(name);
    }
    getActiveTools() {
        const tools = [];
        for (const name of this.activeSkills) {
            const skill = this.skills.get(name);
            if (skill)
                tools.push(...skill.tools);
        }
        return tools;
    }
    /**
     * Select the best skill from active skills using the RL selector.
     * Falls back to the first active skill if no selector is attached.
     */
    selectBestSkill() {
        const active = [...this.activeSkills];
        if (active.length === 0)
            return undefined;
        if (!this.selector)
            return active[0];
        return this.selector.select(active);
    }
    /**
     * Get active tools ordered by skill ranking from the RL selector.
     * Skills with higher reward get their tools listed first.
     */
    getRankedTools() {
        const active = [...this.activeSkills];
        if (active.length === 0)
            return [];
        // Order skills by bandit ranking
        let orderedSkills;
        if (this.selector) {
            const ranking = this.selector.getRanking();
            const rankedActive = ranking
                .filter((r) => this.activeSkills.has(r.armId))
                .map((r) => r.armId);
            // Append any active skills not yet in ranking
            const remaining = active.filter((s) => !rankedActive.includes(s));
            orderedSkills = [...rankedActive, ...remaining];
        }
        else {
            orderedSkills = active;
        }
        const tools = [];
        for (const name of orderedSkills) {
            const skill = this.skills.get(name);
            if (skill) {
                for (const tool of skill.tools) {
                    tools.push({ ...tool, skillName: name });
                }
            }
        }
        return tools;
    }
    /** Send a reward signal for a skill (from user feedback or tool success) */
    rewardSkill(skillName, reward, source = 'tool-success') {
        this.selector?.reward({
            armId: skillName,
            reward,
            source,
            timestamp: new Date(),
        });
    }
    getSkill(name) {
        return this.skills.get(name);
    }
    listSkills() {
        return [...this.skills.values()].map((s) => s.manifest);
    }
    isActive(name) {
        return this.activeSkills.has(name);
    }
}
//# sourceMappingURL=skill-manager.js.map