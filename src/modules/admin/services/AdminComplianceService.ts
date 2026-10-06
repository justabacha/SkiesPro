import { AdminRepository } from '../repositories/AdminRepository.js';

export class AdminComplianceService {
  private readonly repo: AdminRepository;

  constructor() {
    this.repo = new AdminRepository();
  }

  async listPendingKyc(filters: { page: number; perPage: number }) {
    return this.repo.listPendingKyc(filters.page, filters.perPage);
  }

  async getKycById(id: string) {
    return this.repo.getKycById(id);
  }

  async reviewKyc(id: string, action: string, note: string, reviewedBy: string) {
    return this.repo.reviewKyc(id, action, note, reviewedBy);
  }

  async listPendingWithdrawals(filters: { page: number; perPage: number }) {
    return this.repo.listPendingWithdrawals(filters.page, filters.perPage);
  }

  async getWithdrawalById(id: string) {
    return this.repo.getWithdrawalById(id);
  }

  async approveWithdrawal(id: string, reviewedBy: string, note: string) {
    const item = await this.repo.updateWithdrawalStatus(id, 'approved', note, reviewedBy);
    return { id, status: 'approved', reviewedBy, note, item };
  }

  async rejectWithdrawal(id: string, reviewedBy: string, reason: string) {
    const item = await this.repo.updateWithdrawalStatus(id, 'rejected', reason, reviewedBy);
    return { id, status: 'rejected', reviewedBy, reason, item };
  }
}
