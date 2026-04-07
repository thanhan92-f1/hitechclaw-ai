// ============================================================
// OCSF Security Event Logger — Sandbox security events
// ============================================================
// Produces OCSF (Open Cybersecurity Schema Framework) compatible
// security events for sandbox operations. These events can be
// forwarded to SIEM systems.

import type { SandboxAuditEntry } from '@hitechclaw/shared';

/**
 * OCSF Activity ID for sandbox events.
 * Maps to the OCSF Security Finding category (2001).
 */
export enum OCSFActivityId {
  Create = 1,
  Read = 2,
  Update = 3,
  Delete = 4,
  Other = 99,
}

/**
 * OCSF Severity ID.
 */
export enum OCSFSeverityId {
  Unknown = 0,
  Informational = 1,
  Low = 2,
  Medium = 3,
  High = 4,
  Critical = 5,
  Fatal = 6,
}

/**
 * OCSF-compatible security event for sandbox operations.
 */
export interface OCSFSecurityEvent {
  /** OCSF class UID — Process Activity = 1007, Security Finding = 2001 */
  class_uid: number;
  /** OCSF category UID */
  category_uid: number;
  /** Activity ID */
  activity_id: OCSFActivityId;
  /** Activity name */
  activity_name: string;
  /** Severity ID */
  severity_id: OCSFSeverityId;
  /** Event time (ISO-8601) */
  time: string;
  /** Event message */
  message: string;
  /** Status: 'success' | 'failure' | 'unknown' */
  status: string;
  /** Status code */
  status_code?: string;
  /** Metadata */
  metadata: {
    version: string;
    product: { name: string; vendor_name: string; version: string };
    log_name: string;
  };
  /** Actor (sandbox/tenant) */
  actor: {
    user: { uid: string; type: string };
    session: { uid: string };
  };
  /** Resource */
  resources: Array<{
    uid: string;
    name: string;
    type: string;
  }>;
  /** Raw event data */
  unmapped?: Record<string, unknown>;
}

const METADATA = {
  version: '1.1.0',
  product: { name: 'HiTechClaw', vendor_name: 'xDev Asia', version: '2.1.0' },
  log_name: 'sandbox_security',
};

/**
 * Convert a sandbox audit entry to an OCSF security event.
 */
export function toOCSFEvent(entry: SandboxAuditEntry): OCSFSecurityEvent {
  const activityMap: Record<string, { id: OCSFActivityId; name: string }> = {
    create: { id: OCSFActivityId.Create, name: 'Sandbox Create' },
    connect: { id: OCSFActivityId.Read, name: 'Sandbox Connect' },
    execute: { id: OCSFActivityId.Other, name: 'Sandbox Execute' },
    'policy-update': { id: OCSFActivityId.Update, name: 'Policy Update' },
    destroy: { id: OCSFActivityId.Delete, name: 'Sandbox Destroy' },
    blocked: { id: OCSFActivityId.Other, name: 'Action Blocked' },
  };

  const activity = activityMap[entry.action] ?? { id: OCSFActivityId.Other, name: entry.action };

  const severityMap: Record<string, OCSFSeverityId> = {
    create: OCSFSeverityId.Informational,
    connect: OCSFSeverityId.Informational,
    execute: OCSFSeverityId.Low,
    'policy-update': OCSFSeverityId.Medium,
    destroy: OCSFSeverityId.Informational,
    blocked: OCSFSeverityId.High,
  };

  return {
    class_uid: 2001,
    category_uid: 2,
    activity_id: activity.id,
    activity_name: activity.name,
    severity_id: severityMap[entry.action] ?? OCSFSeverityId.Unknown,
    time: entry.timestamp,
    message: `Sandbox ${entry.action}: ${entry.sandboxId} (tenant: ${entry.tenantId})`,
    status: entry.action === 'blocked' ? 'failure' : 'success',
    metadata: METADATA,
    actor: {
      user: { uid: entry.tenantId, type: 'tenant' },
      session: { uid: entry.sandboxId },
    },
    resources: [{
      uid: entry.sandboxId,
      name: `sandbox-${entry.sandboxId.slice(0, 8)}`,
      type: 'container',
    }],
    unmapped: entry.details,
  };
}

/**
 * OCSF event emitter. Sends events to configured destinations.
 */
export class OCSFEventLogger {
  private readonly destinations: Array<(event: OCSFSecurityEvent) => void> = [];

  /** Add a destination handler (e.g., console, SIEM, file) */
  addDestination(handler: (event: OCSFSecurityEvent) => void): void {
    this.destinations.push(handler);
  }

  /** Emit an OCSF event to all destinations */
  emit(event: OCSFSecurityEvent): void {
    for (const dest of this.destinations) {
      try {
        dest(event);
      } catch {
        // Logging should never throw
      }
    }
  }

  /** Convert and emit a sandbox audit entry */
  logAudit(entry: SandboxAuditEntry): void {
    this.emit(toOCSFEvent(entry));
  }

  /** Create a console destination */
  static consoleDestination(): (event: OCSFSecurityEvent) => void {
    return (event) => {
      const prefix = event.severity_id >= OCSFSeverityId.High ? '🔴' : event.severity_id >= OCSFSeverityId.Medium ? '🟡' : '🟢';
      console.log(`${prefix} [OCSF] ${event.activity_name}: ${event.message}`);
    };
  }
}
