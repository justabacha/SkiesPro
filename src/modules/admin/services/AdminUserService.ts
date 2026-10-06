import { AdminRepository } from '../repositories/AdminRepository.js';

export class AdminUserService {
  private readonly repo: AdminRepository;

  constructor() {
    this.repo = new AdminRepository();
  }

  async listUsers(filters: { page: number; perPage: number; status?: string; search?: string }) {
    return this.repo.listUsers(filters);
  }

  async getUserById(id: string) {
    return this.repo.getUserById(id);
  }

  async updateUserStatus(
    userId: string,
    payload: { status: 'active' | 'suspended' | 'closed'; reason: string },
    actorId: string
  ) {
    return this.repo.updateUserStatus(userId, payload, actorId);
  }

  async getUserLedger(userId: string, pagination: { page: number; perPage: number }) {
    return this.repo.getUserLedger(userId, pagination.page, pagination.perPage);
  }
}
