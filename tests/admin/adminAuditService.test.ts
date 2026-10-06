import crypto from 'crypto';
import { AdminAuditService } from '../../src/modules/admin/services/AdminAuditService';
import {
  ADMIN_ROLES,
  hasAdminRole,
  requiresMfaStepUp,
} from '../../src/modules/admin/middleware/adminAuthMiddleware';

describe('AdminAuditService', () => {
  it('computes a SHA-256 chained audit hash using the required fields', () => {
    const details = { note: 'Manual wallet adjustment', amount: 850 };
    const previousHash = 'abc123';
    const createdAt = '2026-10-05T12:00:00.000Z';

    const actual = AdminAuditService.computeEntryHash({
      previousHash,
      actorId: '11111111-1111-4111-8111-111111111111',
      action: 'wallet_adjust',
      affectedEntity: 'wallet',
      details,
      createdAt,
    });

    const expected = crypto
      .createHash('sha256')
      .update(
        `${previousHash}11111111-1111-4111-8111-111111111111wallet_adjustwallet${JSON.stringify(details)}${createdAt}`
      )
      .digest('hex');

    expect(actual).toBe(expected);
    expect(actual).toHaveLength(64);
  });

  it('requires dual approval for high-value adjustments', () => {
    expect(AdminAuditService.requiresSecondApproval(65000)).toBe(true);
    expect(AdminAuditService.requiresSecondApproval(500)).toBe(false);
  });
});

describe('Admin auth middleware helpers', () => {
  it('recognizes the supported admin roles and MFA gate', () => {
    expect(ADMIN_ROLES).toContain('super_admin');
    expect(hasAdminRole('risk_manager')).toBe(true);
    expect(hasAdminRole('trader')).toBe(false);
    expect(requiresMfaStepUp({ mfa_verified: true })).toBe(false);
    expect(requiresMfaStepUp({ mfa_verified: false })).toBe(true);
  });
});
