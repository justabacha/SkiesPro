import { UserRepository, UserRow } from '../../auth/repositories/userRepository.js';
import { storageClient } from '../../../shared/storage/supabaseStorage.js';
import { UpdateProfileDto } from '../dto/UpdateProfileDto.js';
import { ProfileResponseDto } from '../dto/ProfileResponseDto.js';

export class UserService {
  private userRepo: UserRepository;

  constructor() {
    this.userRepo = new UserRepository();
  }

  async getProfile(userId: string): Promise<ProfileResponseDto> {
    const user = await this.userRepo.getProfile(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return this.mapToDto(user);
  }

  async updateProfile(userId: string, data: UpdateProfileDto): Promise<ProfileResponseDto> {
    const user = await this.userRepo.updateProfile(userId, data);
    return this.mapToDto(user);
  }

  async uploadAvatar(userId: string, file: Buffer, filename: string): Promise<string> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Delete old avatar if it exists
    if (user.avatar_url) {
      await storageClient.deleteAvatar(user.avatar_url);
    }

    // Upload new avatar
    const avatarUrl = await storageClient.uploadAvatar(userId, file, filename);

    // Update DB
    await this.userRepo.updateAvatar(userId, avatarUrl);

    return avatarUrl;
  }

  async getKycStatus(userId: string): Promise<string> {
    const status = await this.userRepo.getKycStatus(userId);
    if (!status) {
      throw new Error('User not found');
    }
    return status;
  }

  async initiateKyc(userId: string): Promise<string> {
    const user = await this.userRepo.initiateKyc(userId);
    console.log(`KYC initiated for user ${userId} at ${new Date().toISOString()}`);
    return user.kyc_status;
  }

  private mapToDto(user: UserRow): ProfileResponseDto {
    return {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      phone: user.phone,
      avatar_url: user.avatar_url || null,
      kyc_status: user.kyc_status,
      created_at: user.created_at.toISOString(),
    };
  }
}
