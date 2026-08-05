import { prisma } from "@/lib/db";

export interface AuditEntry {
  actorType: "user" | "system" | "worker";
  actorId?: string;
  /** Dot-namespaced, past tense: "discovery.run.started", "discovery.candidate.rejected", "settings.updated". */
  action: string;
  entityType: string;
  entityId: string;
  detail?: Record<string, unknown>;
}

/**
 * Appends an audit row. Deliberately never throws: an audit failure must not break
 * the business operation it describes — it is logged to stderr instead so the
 * condition is still visible operationally.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorType: entry.actorType,
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        detail: entry.detail as object | undefined,
      },
    });
  } catch (error) {
    console.error(`[audit] failed to record ${entry.action} for ${entry.entityType}:${entry.entityId}`, error);
  }
}
