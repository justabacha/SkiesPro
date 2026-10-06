import { AdminAuditService } from './AdminAuditService.js';
import { AdminRepository } from '../repositories/AdminRepository.js';

export class AdminWalletService {
  private readonly repo: AdminRepository;
  private readonly audit: AdminAuditService;

  constructor() {
    this.repo = new AdminRepository();
    this.audit = new AdminAuditService();
  }

  static requiresSecondApproval(amount: number): boolean {
    return AdminAuditService.requiresSecondApproval(amount);
  }

  async adjustWallet(input: {
    actorId: string;
    userId: string;
    amount: number;
    type: 'credit' | 'debit';
    reason: string;
    idempotencyKey: string;
  }): Promise<{ status: string; actionId?: string; amount: number; type: string; userId: string }> {
    const requiresApproval = AdminWalletService.requiresSecondApproval(input.amount);

    const action = await this.repo.createAdminAction({
      adminId: input.actorId,
      actionType: 'wallet_adjustment',
      targetUserId: input.userId,
      details: {
        user_id: input.userId,
        amount: input.amount,
        type: input.type,
        reason: input.reason,
        idempotency_key: input.idempotencyKey,
      },
      requiresApproval,
    });

    if (requiresApproval) {
      await this.audit.createEntry({
        actorId: input.actorId,
        action: 'wallet_adjustment_pending_approval',
        affectedEntity: 'wallet',
        entityId: input.userId,
        details: {
          action_id: action.id,
          amount: input.amount,
          type: input.type,
          reason: input.reason,
        },
      });

      return {
        status: 'pending_second_approval',
        actionId: action.id,
        amount: input.amount,
        type: input.type,
        userId: input.userId,
      };
    }

    await this.audit.createEntry({
      actorId: input.actorId,
      action: 'wallet_adjustment_applied',
      affectedEntity: 'wallet',
      entityId: input.userId,
      details: {
        action_id: action.id,
        amount: input.amount,
        type: input.type,
        reason: input.reason,
      },
    });

    return {
      status: 'applied',
      actionId: action.id,
      amount: input.amount,
      type: input.type,
      userId: input.userId,
    };
  }

  async approveAction(
    actionId: string,
    approvedBy: string
  ): Promise<{ status: string; actionId: string; approvedBy: string }> {
    const action = await this.repo.approveAdminAction(actionId, approvedBy);
    await this.audit.createEntry({
      actorId: approvedBy,
      action: 'admin_action_approved',
      affectedEntity: 'admin_action',
      entityId: actionId,
      details: {
        approved_by: approvedBy,
        action_type: action?.action_type,
      },
    });

    return {
      status: 'approved',
      actionId,
      approvedBy,
    };
  }
}
