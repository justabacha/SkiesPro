import { AdminRepository } from '../repositories/AdminRepository.js';

export class AdminReportService {
  private readonly repo: AdminRepository;

  constructor() {
    this.repo = new AdminRepository();
  }

  async getDailyRevenue(dateFrom?: string, dateTo?: string) {
    const reports = await this.repo.getReports(dateFrom, dateTo);
    return { revenue: reports.dailyRevenue };
  }

  async getTradeVolume(dateFrom?: string, dateTo?: string) {
    const reports = await this.repo.getReports(dateFrom, dateTo);
    return { volume: reports.tradeVolume };
  }

  async getUserRegistrations(dateFrom?: string, dateTo?: string) {
    const reports = await this.repo.getReports(dateFrom, dateTo);
    return { registrations: reports.userRegistrations };
  }

  async getSettlementPerformance(dateFrom?: string, dateTo?: string) {
    const reports = await this.repo.getReports(dateFrom, dateTo);
    return { settlement: reports.settlementPerformance };
  }
}
