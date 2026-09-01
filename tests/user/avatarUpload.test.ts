import request from 'supertest';
import app from '../../src/index.js';
import { TokenService } from '../../src/modules/auth/services/tokenService.js';
import { storageClient } from '../../src/shared/storage/supabaseStorage.js';
import { UserRepository } from '../../src/modules/auth/repositories/userRepository.js';

jest.mock('../../src/shared/storage/supabaseStorage');
jest.mock('../../src/modules/auth/repositories/userRepository');
jest.mock('../../src/modules/auth/services/tokenService');

describe('Avatar Upload', () => {
  let token = 'user-123';

  beforeEach(() => {
    (TokenService.prototype.validateAccessToken as jest.Mock).mockImplementation((t) => {
      return { sub: t, role: 'trader', permissions: [], jti: 'mock-jti' };
    });
    (TokenService.prototype.isTokenRevoked as jest.Mock).mockResolvedValue(false);
  });

  it('should upload avatar successfully', async () => {
    (UserRepository.prototype.findById as jest.Mock).mockResolvedValue({ id: 'user-123', avatar_url: null });
    (storageClient.uploadAvatar as jest.Mock).mockResolvedValue('http://supabase.com/avatar.jpg');

    const response = await request(app)
      .post('/api/v1/users/profile/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', Buffer.from('fake-image-data'), 'avatar.jpg');

    expect(response.status).toBe(200);
    expect(response.body.data.avatar_url).toBe('http://supabase.com/avatar.jpg');
    expect(storageClient.uploadAvatar).toHaveBeenCalled();
  });

  it('should delete old avatar if exists', async () => {
    (UserRepository.prototype.findById as jest.Mock).mockResolvedValue({
      id: 'user-123',
      avatar_url: 'http://supabase.com/old.jpg'
    });
    (storageClient.uploadAvatar as jest.Mock).mockResolvedValue('http://supabase.com/new.jpg');

    await request(app)
      .post('/api/v1/users/profile/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', Buffer.from('fake-image-data'), 'new.jpg');

    expect(storageClient.deleteAvatar).toHaveBeenCalledWith('http://supabase.com/old.jpg');
  });

  it('should reject non-image files', async () => {
    const response = await request(app)
      .post('/api/v1/users/profile/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', Buffer.from('fake-text-data'), 'test.txt');

    expect(response.status).toBe(400);
  });
});
