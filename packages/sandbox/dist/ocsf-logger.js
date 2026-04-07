// ============================================================
// OCSF Security Event Logger — Sandbox security events
// ============================================================
// Produces OCSF (Open Cybersecurity Schema Framework) compatible
// security events for sandbox operations. These events can be
// forwarded to SIEM systems.
/**
 * OCSF Activity ID for sandbox events.
 * Maps to the OCSF Security Finding category (2001).
 */
export var OCSFActivityId;
(function (OCSFActivityId) {
    OCSFActivityId[OCSFActivityId["Create"] = 1] = "Create";
    OCSFActivityId[OCSFActivityId["Read"] = 2] = "Read";
    OCSFActivityId[OCSFActivityId["Update"] = 3] = "Update";
    OCSFActivityId[OCSFActivityId["Delete"] = 4] = "Delete";
    OCSFActivityId[OCSFActivityId["Other"] = 99] = "Other";
})(OCSFActivityId || (OCSFActivityId = {}));
/**
 * OCSF Severity ID.
 */
export var OCSFSeverityId;
(function (OCSFSeverityId) {
    OCSFSeverityId[OCSFSeverityId["Unknown"] = 0] = "Unknown";
    OCSFSeverityId[OCSFSeverityId["Informational"] = 1] = "Informational";
    OCSFSeverityId[OCSFSeverityId["Low"] = 2] = "Low";
    OCSFSeverityId[OCSFSeverityId["Medium"] = 3] = "Medium";
    OCSFSeverityId[OCSFSeverityId["High"] = 4] = "High";
    OCSFSeverityId[OCSFSeverityId["Critical"] = 5] = "Critical";
    OCSFSeverityId[OCSFSeverityId["Fatal"] = 6] = "Fatal";
})(OCSFSeverityId || (OCSFSeverityId = {}));
const METADATA = {
    version: '1.1.0',
    product: { name: 'HiTechClaw', vendor_name: 'xDev Asia', version: '2.1.0' },
    log_name: 'sandbox_security',
};
/**
 * Convert a sandbox audit entry to an OCSF security event.
 */
export function toOCSFEvent(entry) {
    var _a, _b;
    const activityMap = {
        create: { id: OCSFActivityId.Create, name: 'Sandbox Create' },
        connect: { id: OCSFActivityId.Read, name: 'Sandbox Connect' },
        execute: { id: OCSFActivityId.Other, name: 'Sandbox Execute' },
        'policy-update': { id: OCSFActivityId.Update, name: 'Policy Update' },
        destroy: { id: OCSFActivityId.Delete, name: 'Sandbox Destroy' },
        blocked: { id: OCSFActivityId.Other, name: 'Action Blocked' },
    };
    const activity = (_a = activityMap[entry.action]) !== null && _a !== void 0 ? _a : { id: OCSFActivityId.Other, name: entry.action };
    const severityMap = {
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
        severity_id: (_b = severityMap[entry.action]) !== null && _b !== void 0 ? _b : OCSFSeverityId.Unknown,
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
    constructor() {
        this.destinations = [];
    }
    /** Add a destination handler (e.g., console, SIEM, file) */
    addDestination(handler) {
        this.destinations.push(handler);
    }
    /** Emit an OCSF event to all destinations */
    emit(event) {
        for (const dest of this.destinations) {
            try {
                dest(event);
            }
            catch (_a) {
                // Logging should never throw
            }
        }
    }
    /** Convert and emit a sandbox audit entry */
    logAudit(entry) {
        this.emit(toOCSFEvent(entry));
    }
    /** Create a console destination */
    static consoleDestination() {
        return (event) => {
            const prefix = event.severity_id >= OCSFSeverityId.High ? '🔴' : event.severity_id >= OCSFSeverityId.Medium ? '🟡' : '🟢';
            console.log(`${prefix} [OCSF] ${event.activity_name}: ${event.message}`);
        };
    }
}
