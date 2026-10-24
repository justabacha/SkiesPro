import { Request, Response } from 'express';
import { AuthController } from '../../src/modules/auth/controllers/authController.js';
import { AuthService } from '../../src/modules/auth/services/authService.js';

describe('AuthController.adminMfaStepUp', () => {
  it('returns 400 with INVALID_TOTP for a rejected authenticator code', async () => {
    const authService = {
      verifyAdminStepUp: jest.fn().mockRejectedValue(new Error('INVALID_TOTP')),
    };
    const controller = new AuthController(authService as unknown as AuthService);
    const req = {
      user: { sub: 'admin-user', role: 'admin' },
      body: { totp_code: '000000' },
    } as unknown as Request;
    const responseBody = jest.fn();
    const status = jest.fn().mockReturnValue({ json: responseBody });
    const res = { status } as unknown as Response;

    await controller.adminMfaStepUp(req, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(responseBody).toHaveBeenCalledWith({
      error: 'Invalid TOTP code',
      code: 'INVALID_TOTP',
    });
  });
});
