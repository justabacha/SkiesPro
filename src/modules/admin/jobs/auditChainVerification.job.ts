import { AdminAuditService } from '../services/AdminAuditService.js';

export class AuditChainVerificationJob {
  private readonly auditService: AdminAuditService;

  constructor() {
    this.auditService = new AdminAuditService();
  }

  async run(): Promise<{ valid: boolean; checked: number; mismatches: string[] }> {
    return this.auditService.verifyChain();
  }
}
