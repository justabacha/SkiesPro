import crypto from 'crypto';
import { AdminRepository } from '../repositories/AdminRepository.js';

export interface AuditHashInput {
  previousHash: string;
  actorId: string;
  action: string;
  affectedEntity: string;
  details: Record<string, any>;
  createdAt: string;
}

export class AdminAuditService {
  static computeEntryHash(input: AuditHashInput): string {
    const detailsObj =
      typeof input.details === 'string' ? JSON.parse(input.details) : input.details || {};
    const payload = `${input.previousHash}${input.actorId}${input.action}${input.affectedEntity}${JSON.stringify(detailsObj)}${input.createdAt}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  static requiresSecondApproval(amountInUsd: number): boolean {
    return amountInUsd > 500;
  }

  private readonly repo: AdminRepository;

  constructor() {
    this.repo = new AdminRepository();
  }

  async createEntry(input: {
    actorId: string | null;
    action: string;
    affectedEntity: string;
    entityId?: string | null;
    details: Record<string, any>;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<any> {
    return this.repo.createAuditLog({
      actorId: input.actorId,
      action: input.action,
      affectedEntity: input.affectedEntity,
      entityId: input.entityId,
      details: input.details,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
  }

  async listAuditLogs(filters: {
    actorId?: string;
    action?: string;
    affectedEntity?: string;
    dateFrom?: string;
    dateTo?: string;
    page: number;
    perPage: number;
  }): Promise<{ rows: any[]; total: number }> {
    return this.repo.getAuditLogs(filters);
  }

  async verifyChain(): Promise<{ valid: boolean; checked: number; mismatches: string[] }> {
    const auditLogs = await this.repo.getAuditLogs({ page: 1, perPage: 1000 });
    const logs = [...auditLogs.rows].sort((a, b) => Number(a.id) - Number(b.id));
    const mismatches: string[] = [];

    for (let i = 0; i < logs.length; i += 1) {
      const current = logs[i];
      const previous = i > 0 ? logs[i - 1] : null;

      if (i > 0 && current.previous_entry_hash !== previous!.entry_hash) {
        mismatches.push(String(current.id));
        continue;
      }

      const detailsObj =
        typeof current.details === 'string' ? JSON.parse(current.details) : current.details || {};
      const createdAtIso = new Date(current.created_at).toISOString();

      const expected = AdminAuditService.computeEntryHash({
        previousHash: current.previous_entry_hash,
        actorId: current.actor_id || 'system',
        action: current.action,
        affectedEntity: current.affected_entity,
        details: detailsObj,
        createdAt: createdAtIso,
      });

      if (current.entry_hash !== expected) {
        mismatches.push(String(current.id));
      }
    }

    return {
      valid: mismatches.length === 0,
      checked: logs.length,
      mismatches,
    };
  }
}
