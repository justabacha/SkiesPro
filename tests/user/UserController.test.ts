import request from 'supertest';
import app from '../../src/index';
import { TokenService } from '../../src/modules/auth/services/tokenService';
import { UserRepository } from '../../src/modules/auth/repositories/userRepository';

jest.mock('../../src/modules/auth/repositories/userRepository');

describe('UserController Integration', () => {
  let token: string;

  beforeAll(() => {
    const tokenService = new TokenService();
    const { token: accessToken } = tokenService.generateAccessToken('user-123', 'trader', []);
    token = accessToken;
  });

  describe('GET /api/v1/users/profile', () => {
    it('should return 200 with user profile', async () => {
      (UserRepository.prototype.getProfile as jest.Mock).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        display_name: 'Test User',
        kyc_status: 'unverified',
        created_at: new Date(),
      });

      const response = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe('user-123');
    });

    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/v1/users/profile');
      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/v1/users/profile', () => {
    it('should update profile and return 200', async () => {
      (UserRepository.prototype.updateProfile as jest.Mock).mockResolvedValue({
        id: 'user-123',
        display_name: 'Updated Name',
        created_at: new Date(),
      });

      const response = await request(app)
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ display_name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(response.body.data.display_name).toBe('Updated Name');
    });
  });
});
