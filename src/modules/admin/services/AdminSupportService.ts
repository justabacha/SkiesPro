import { AdminRepository } from '../repositories/AdminRepository.js';

export class AdminSupportService {
  private readonly repo: AdminRepository;

  constructor() {
    this.repo = new AdminRepository();
  }

  async listTickets(filters: {
    status?: string;
    priority?: string;
    page: number;
    perPage: number;
  }) {
    return this.repo.listSupportTickets(filters);
  }

  async getTicketById(id: string) {
    return this.repo.getSupportTicketById(id);
  }

  async updateTicket(
    id: string,
    payload: { status?: string; response?: string; assigned_to?: string | null },
    assignedBy: string
  ) {
    const ticket = await this.repo.updateSupportTicket(id, {
      status: payload.status || 'in_progress',
      response: payload.response,
      assigned_to: payload.assigned_to,
    });

    return {
      id,
      assignedBy,
      ticket,
    };
  }
}
