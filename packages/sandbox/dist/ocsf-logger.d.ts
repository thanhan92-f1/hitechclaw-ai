import type { SandboxAuditEntry } from '@hitechclaw/shared';
/**
 * OCSF Activity ID for sandbox events.
 * Maps to the OCSF Security Finding category (2001).
 */
export declare enum OCSFActivityId {
    Create = 1,
    Read = 2,
    Update = 3,
    Delete = 4,
    Other = 99
}
/**
 * OCSF Severity ID.
 */
export declare enum OCSFSeverityId {
    Unknown = 0,
    Informational = 1,
    Low = 2,
    Medium = 3,
    High = 4,
    Critical = 5,
    Fatal = 6
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
        product: {
            name: string;
            vendor_name: string;
            version: string;
        };
        log_name: string;
    };
    /** Actor (sandbox/tenant) */
    actor: {
        user: {
            uid: string;
            type: string;
        };
        session: {
            uid: string;
        };
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
/**
 * Convert a sandbox audit entry to an OCSF security event.
 */
export declare function toOCSFEvent(entry: SandboxAuditEntry): OCSFSecurityEvent;
/**
 * OCSF event emitter. Sends events to configured destinations.
 */
export declare class OCSFEventLogger {
    private readonly destinations;
    /** Add a destination handler (e.g., console, SIEM, file) */
    addDestination(handler: (event: OCSFSecurityEvent) => void): void;
    /** Emit an OCSF event to all destinations */
    emit(event: OCSFSecurityEvent): void;
    /** Convert and emit a sandbox audit entry */
    logAudit(entry: SandboxAuditEntry): void;
    /** Create a console destination */
    static consoleDestination(): (event: OCSFSecurityEvent) => void;
}
//# sourceMappingURL=ocsf-logger.d.ts.map