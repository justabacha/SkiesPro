import { useState, useCallback, useEffect } from 'react';
import { adminApiClient, SupportTicket } from '@/services/admin/adminApiClient';

export function useAdminSupport() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');

  const fetchTickets = useCallback(
    async (totp_code?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const list = await adminApiClient.getTickets(
          {
            status: statusFilter || undefined,
            priority: priorityFilter || undefined,
          },
          totp_code
        );
        setTickets(list);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    },
    [statusFilter, priorityFilter]
  );

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

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
          if (updatedTicket) setSelectedTicket(updatedTicket);
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
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    fetchTickets,
    selectTicket,
    clearSelectedTicket: () => setSelectedTicket(null),
    updateTicket,
  };
}
