import { UserService } from '../../src/modules/user/services/UserService';
import { UserRepository } from '../../src/modules/auth/repositories/userRepository';
import '../../src/shared/storage/supabaseStorage';

jest.mock('../../src/modules/auth/repositories/userRepository');
jest.mock('../../src/shared/storage/supabaseStorage');

describe('UserService', () => {
  let userService: UserService;
  let userRepo: jest.Mocked<UserRepository>;

  beforeEach(() => {
    userRepo = new UserRepository() as any;
    userService = new UserService();
    (userService as any).userRepo = userRepo;
  });

  describe('getProfile', () => {
    it('should return profile for valid user', async () => {
      userRepo.getProfile.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        display_name: 'Test User',
        phone: '+254712345678',
        avatar_url: 'http://avatar.url',
        kyc_status: 'unverified',
        created_at: new Date(),
      } as any);

      const profile = await userService.getProfile('user-123');
      expect(profile.id).toBe('user-123');
      expect(profile.display_name).toBe('Test User');
    });

    it('should throw error if user not found', async () => {
      userRepo.getProfile.mockResolvedValue(null);
      await expect(userService.getProfile('none')).rejects.toThrow('User not found');
    });
  });

  describe('updateProfile', () => {
    it('should update profile fields', async () => {
      userRepo.updateProfile.mockResolvedValue({
        id: 'user-123',
        display_name: 'New Name',
        phone: '+254712345678',
        created_at: new Date(),
      } as any);

      const profile = await userService.updateProfile('user-123', { display_name: 'New Name' });
      expect(profile.display_name).toBe('New Name');
    });
  });

  describe('initiateKyc', () => {
    it('should transition status to pending', async () => {
      userRepo.initiateKyc.mockResolvedValue({ kyc_status: 'pending' } as any);
      const status = await userService.initiateKyc('user-123');
      expect(status).toBe('pending');
    });
  });
});
