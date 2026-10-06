import { requireAdminMfa } from '../../src/modules/admin/middleware/adminAuthMiddleware.js';
import { TokenService } from '../../src/modules/auth/services/tokenService.js';

jest.mock('../../src/modules/auth/services/tokenService.js');

describe('requireAdminMfa', () => {
  const validateAdminMfaToken = TokenService.prototype.validateAdminMfaToken as jest.Mock;
  const next = jest.fn();
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects non-staff users with the explicit role error code', () => {
    requireAdminMfa(
      { user: { sub: 'user-id', role: 'trader' }, header: jest.fn() } as never,
      response as never,
      next
    );

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'FORBIDDEN_NOT_ADMIN' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('requires an unexpired, subject-matched step-up token', () => {
    validateAdminMfaToken.mockReturnValue(null);
    requireAdminMfa(
      {
        user: { sub: 'admin-id', role: 'admin' },
        header: jest.fn().mockReturnValue(undefined),
      } as never,
      response as never,
      next
    );

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'MFA_STEP_UP_REQUIRED' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('continues only when the step-up token matches the authenticated administrator', () => {
    validateAdminMfaToken.mockReturnValue({
      sub: 'admin-id',
      role: 'admin',
      purpose: 'admin_mfa_step_up',
    });
    requireAdminMfa(
      {
        user: { sub: 'admin-id', role: 'admin' },
        header: jest.fn().mockReturnValue('signed-token'),
      } as never,
      response as never,
      next
    );

    expect(next).toHaveBeenCalledTimes(1);
  });
});
