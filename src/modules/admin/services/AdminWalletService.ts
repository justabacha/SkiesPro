import { AdminAuditService } from './AdminAuditService.js';
import { AdminRepository } from '../repositories/AdminRepository.js';
import { TokenService } from '../../auth/services/tokenService.js';
import { MfaService } from '../../auth/services/mfaService.js';
import { MfaRepository } from '../../auth/repositories/mfaRepository.js';

export class AdminWalletService {
  private readonly repo: AdminRepository;
  private readonly audit: AdminAuditService;

  constructor(repo?: AdminRepository, audit?: AdminAuditService) {
    this.repo = repo || new AdminRepository();
    this.audit = audit || new AdminAuditService();
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
    const action = await this.repo.getAdminActionForUpdate(actionId);
    if (!action) {
      throw new Error('Action not found');
    }
    const currentStatus =
      action.status ||
      (action.approved_at ? 'approved' : action.rejected_at ? 'rejected' : 'pending');
    if (currentStatus !== 'pending') {
      throw new Error(`Cannot approve action with status '${currentStatus}'`);
    }

    const updated = await this.repo.approveAdminAction(actionId, approvedBy);
    if (!updated) {
      throw new Error('Cannot approve action');
    }

    await this.audit.createEntry({
      actorId: approvedBy,
      action: 'admin_action_approved',
      affectedEntity: 'admin_action',
      entityId: actionId,
      details: {
        approved_by: approvedBy,
        action_type: updated.action_type,
      },
    });

    return {
      status: 'approved',
      actionId,
      approvedBy,
    };
  }

  async rejectAction(
    id: string,
    adminId: string,
    reason: string,
    totpCode?: string
  ): Promise<{ status: string; actionId: string; rejectedBy: string; reason: string }> {
    if (!reason || reason.trim() === '') {
      throw new Error('Rejection reason is required');
    }

    if (!totpCode) {
      throw new Error('TOTP code is required');
    }

    const tokenService = new TokenService();
    const mfaService = new MfaService();
    const mfaRepo = new MfaRepository();

    let isAuthorized = false;
    const stepUpPayload = tokenService.validateAdminMfaToken(totpCode);
    if (stepUpPayload && stepUpPayload.sub === adminId) {
      isAuthorized = true;
    } else {
      try {
        const mfa = await mfaRepo.findByUserId(adminId);
        if (mfa && mfa.is_enabled) {
          const secret = mfaService.decrypt(mfa.secret_encrypted);
          isAuthorized = await mfaService.verifyToken(totpCode, secret);
        }
      } catch (e) {
        isAuthorized = false;
      }
    }

    if (!isAuthorized) {
      throw new Error('Invalid or missing TOTP code');
    }

    const action = await this.repo.getAdminActionForUpdate(id);
    if (!action) {
      throw new Error('Action not found');
    }

    const currentStatus =
      action.status ||
      (action.approved_at ? 'approved' : action.rejected_at ? 'rejected' : 'pending');
    if (currentStatus !== 'pending') {
      throw new Error(`Cannot reject action with status '${currentStatus}'`);
    }

    const updated = await this.repo.rejectAdminAction(id, adminId, reason.trim());
    if (!updated) {
      throw new Error('Cannot reject action');
    }

    await this.audit.createEntry({
      actorId: adminId,
      action: 'admin_action_rejected',
      affectedEntity: 'admin_action',
      entityId: id,
      details: {
        rejected_by: adminId,
        rejection_reason: reason.trim(),
        action_type: action.action_type,
      },
    });

    return {
      status: 'rejected',
      actionId: id,
      rejectedBy: adminId,
      reason: reason.trim(),
    };
  }

  async listPendingActions(): Promise<any[]> {
    return this.repo.getPendingAdminActions();
  }
}
