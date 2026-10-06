import { AdminRepository } from '../repositories/AdminRepository.js';

export class AdminRiskService {
  private readonly repo: AdminRepository;

  constructor() {
    this.repo = new AdminRepository();
  }

  async getDashboard() {
    return this.repo.getRiskDashboard();
  }

  async getExposure() {
    return this.repo.getRiskExposure();
  }

  async updateAssetConfig(symbol: string, payload: Record<string, any>, updatedBy: string) {
    return this.repo.updateAssetConfig(symbol, payload, updatedBy);
  }

  async listSettings() {
    return this.repo.listSettings();
  }

  async getSetting(key: string) {
    return this.repo.getSetting(key);
  }

  async updateSettings(key: string, value: string, updatedBy: string, reason: string) {
    return this.repo.setSetting(key, value, updatedBy, reason);
  }
}
