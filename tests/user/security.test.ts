import request from 'supertest';
import app from '../../src/index';
import { TokenService } from '../../src/modules/auth/services/tokenService';
import { UserRepository } from '../../src/modules/auth/repositories/userRepository';

jest.mock('../../src/modules/auth/repositories/userRepository');
jest.mock('../../src/modules/auth/services/tokenService');

describe('User Module Security', () => {
  beforeEach(() => {
    (TokenService.prototype.validateAccessToken as jest.Mock).mockImplementation((token) => {
      if (token === 'invalid-token') return null;
      return { sub: token, role: 'trader', permissions: [], jti: 'mock-jti' };
    });
    (TokenService.prototype.isTokenRevoked as jest.Mock).mockResolvedValue(false);
  });

  it('should use userId from token, not from request body', async () => {
    const userId = 'user-A';

    (UserRepository.prototype.getProfile as jest.Mock).mockImplementation((id) => {
      return Promise.resolve({
        id,
        email: id + '@test.com',
        display_name: 'User ' + id,
        phone: null,
        avatar_url: null,
        kyc_status: 'unverified',
        created_at: new Date(),
      });
    });

    const response = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${userId}`);

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(userId);
  });

  it('should return 401 for invalid token', async () => {
    const response = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
  });
});
