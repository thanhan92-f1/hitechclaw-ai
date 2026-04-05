import { createHash } from "crypto";
import { query } from "@/lib/db";

/**
 * Validate an agent bearer token against the database.
 * Returns the agent_id if valid, null if not.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Parse agent tokens from env var format: "agent1:token1,agent2:token2"
 */
export function parseAgentTokens(): Map<string, string> {
  const raw = process.env.MC_AGENT_TOKENS || "";
  const map = new Map<string, string>();
  for (const pair of raw.split(",")) {
    const [agentId, token] = pair.split(":");
    if (agentId && token) {
      map.set(hashToken(token.trim()), agentId.trim());
    }
  }
  return map;
}

/**
 * Validate bearer token from request header.
 * Returns agent_id if valid, null otherwise.
 */
export async function validateToken(authHeader: string | null): Promise<string | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const hash = hashToken(token);

  try {
    const result = await query(
      "SELECT id FROM agents WHERE token_hash = $1 LIMIT 1",
      [hash]
    );
    const dbAgentId = result.rows[0]?.id;
    if (typeof dbAgentId === "string" && dbAgentId) {
      return dbAgentId;
    }
  } catch {
    // Fall back to legacy env-based tokens below.
  }

  const tokenMap = parseAgentTokens();
  return tokenMap.get(hash) || null;
}
