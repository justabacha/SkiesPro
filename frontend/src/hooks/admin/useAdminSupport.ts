import { useState, useCallback, useEffect } from 'react';
import { adminApiClient, SupportTicket } from '@/services/admin/adminApiClient';

const SUPPORT_PAGE_SIZE = 20;

export function useAdminSupport() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalTickets, setTotalTickets] = useState(0);

  const fetchTickets = useCallback(
    async (totp_code?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const list = await adminApiClient.getTickets(
          {
            status: statusFilter || undefined,
            priority: priorityFilter || undefined,
            page,
            per_page: SUPPORT_PAGE_SIZE,
          },
          totp_code
        );
        setTickets(list.rows);
        setTotalTickets(list.total);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    },
    [statusFilter, priorityFilter, page]
  );

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const changeStatusFilter = useCallback((status: string) => {
    setStatusFilter(status);
    setPage(1);
  }, []);

  const changePriorityFilter = useCallback((priority: string) => {
    setPriorityFilter(priority);
    setPage(1);
  }, []);

  const selectTicket = useCallback(async (id: string, totp_code?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const ticket = await adminApiClient.getTicketById(id, totp_code);
      setSelectedTicket(ticket);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateTicket = useCallback(
    async (
      id: string,
      payload: { status?: string; priority?: string; response_message?: string; agent_notes?: string; totp_code?: string }
    ) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await adminApiClient.updateTicket(id, payload);
        await fetchTickets(payload.totp_code);
        if (selectedTicket && selectedTicket.id === id) {
          const updatedTicket = res && typeof res === 'object' && 'ticket' in res
            ? (res as { ticket: SupportTicket }).ticket
            : (res as SupportTicket);
          if (updatedTicket) {
            setSelectedTicket({
              ...selectedTicket,
              ...updatedTicket,
              user_email: updatedTicket.user_email || selectedTicket.user_email,
              user_name: updatedTicket.user_name ?? selectedTicket.user_name,
            });
          }
        }
        return res;
      } catch (err) {
        setError((err as Error).message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchTickets, selectedTicket]
  );

  return {
    tickets,
    selectedTicket,
    isLoading,
    error,
    statusFilter,
    setStatusFilter: changeStatusFilter,
    priorityFilter,
    setPriorityFilter: changePriorityFilter,
    page,
    pageSize: SUPPORT_PAGE_SIZE,
    totalTickets,
    setPage,
    fetchTickets,
    selectTicket,
    clearSelectedTicket: () => setSelectedTicket(null),
    updateTicket,
  };
}
