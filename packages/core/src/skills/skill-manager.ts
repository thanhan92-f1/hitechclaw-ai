import type { SkillManifest, ToolDefinition } from '@hitechclaw/shared';
import type { ToolHandler } from '../tools/tool-registry.js';

export interface SkillDefinition {
  manifest: SkillManifest;
  tools: Array<{ definition: ToolDefinition; handler: ToolHandler }>;
  activate?: () => Promise<void>;
  deactivate?: () => Promise<void>;
}

/** Interface for pluggable skill selection strategies (e.g. BanditSelector from @hitechclaw/ml) */
export interface SkillSelector {
  addArm(armId: string): void;
  removeArm(armId: string): void;
  select(availableArms?: string[]): string;
  reward(signal: { armId: string; reward: number; source: string; timestamp: Date }): void;
  getRanking(): Array<{ armId: string; stats: { meanReward: number; pulls: number } }>;
}

export function defineSkill(skill: SkillDefinition): SkillDefinition {
  return skill;
}

export class SkillManager {
  private skills = new Map<string, SkillDefinition>();
  private activeSkills = new Set<string>();
  private selector: SkillSelector | null = null;

  /** Attach a bandit/RL selector for intelligent skill ranking */
  setSelector(selector: SkillSelector): void {
    this.selector = selector;
    // Register all existing skills as arms
    for (const name of this.skills.keys()) {
      selector.addArm(name);
    }
  }

  getSelector(): SkillSelector | null {
    return this.selector;
  }

  register(skill: SkillDefinition): void {
    this.skills.set(skill.manifest.name, skill);
    this.selector?.addArm(skill.manifest.name);
  }

  async activate(name: string): Promise<void> {
    const skill = this.skills.get(name);
    if (!skill) throw new Error(`Skill "${name}" not found`);
    if (this.activeSkills.has(name)) return;

    if (skill.activate) await skill.activate();
    this.activeSkills.add(name);
  }

  async deactivate(name: string): Promise<void> {
    const skill = this.skills.get(name);
    if (!skill || !this.activeSkills.has(name)) return;

    if (skill.deactivate) await skill.deactivate();
    this.activeSkills.delete(name);
  }

  getActiveTools(): Array<{ definition: ToolDefinition; handler: ToolHandler }> {
    const tools: Array<{ definition: ToolDefinition; handler: ToolHandler }> = [];
    for (const name of this.activeSkills) {
      const skill = this.skills.get(name);
      if (skill) tools.push(...skill.tools);
    }
    return tools;
  }

  /**
   * Select the best skill from active skills using the RL selector.
   * Falls back to the first active skill if no selector is attached.
   */
  selectBestSkill(): string | undefined {
    const active = [...this.activeSkills];
    if (active.length === 0) return undefined;
    if (!this.selector) return active[0];
    return this.selector.select(active);
  }

  /**
   * Get active tools ordered by skill ranking from the RL selector.
   * Skills with higher reward get their tools listed first.
   */
  getRankedTools(): Array<{ definition: ToolDefinition; handler: ToolHandler; skillName: string }> {
    const active = [...this.activeSkills];
    if (active.length === 0) return [];

    // Order skills by bandit ranking
    let orderedSkills: string[];
    if (this.selector) {
      const ranking = this.selector.getRanking();
      const rankedActive = ranking
        .filter((r) => this.activeSkills.has(r.armId))
        .map((r) => r.armId);
      // Append any active skills not yet in ranking
      const remaining = active.filter((s) => !rankedActive.includes(s));
      orderedSkills = [...rankedActive, ...remaining];
    } else {
      orderedSkills = active;
    }

    const tools: Array<{ definition: ToolDefinition; handler: ToolHandler; skillName: string }> = [];
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
  rewardSkill(skillName: string, reward: number, source: 'user-feedback' | 'tool-success' | 'latency' | 'composite' = 'tool-success'): void {
    this.selector?.reward({
      armId: skillName,
      reward,
      source,
      timestamp: new Date(),
    });
  }

  getSkill(name: string): SkillDefinition | undefined {
    return this.skills.get(name);
  }

  listSkills(): SkillManifest[] {
    return [...this.skills.values()].map((s) => s.manifest);
  }

  isActive(name: string): boolean {
    return this.activeSkills.has(name);
  }
}
