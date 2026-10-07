import { useState, useCallback, useEffect } from 'react';
import { adminApiClient, UserSummary, UserDetail, UserLedgerEntry } from '@/services/admin/adminApiClient';

export function useAdminUsers() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [ledger, setLedger] = useState<UserLedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDrawerLoading, setIsDrawerLoading] = useState<boolean>(false);
  const [isLedgerLoading, setIsLedgerLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('');

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminApiClient.getUsers({
        search: search || undefined,
        status: statusFilter || undefined,
        role: roleFilter || undefined,
      });
      setUsers(data?.rows || []);
    } catch (err) {
      setError((err as Error).message || 'Failed to load user directory.');
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const selectUser = useCallback(async (id: string) => {
    setIsDrawerLoading(true);
    setError(null);
    try {
      const user = await adminApiClient.getUserById(id);
      setSelectedUser(user);
    } catch (err) {
      setError((err as Error).message || 'Failed to load user details.');
    } finally {
      setIsDrawerLoading(false);
    }
  }, []);

  const clearSelectedUser = useCallback(() => {
    setSelectedUser(null);
    setLedger([]);
    setIsDrawerLoading(false);
    setIsLedgerLoading(false);
  }, []);

  const updateUserStatus = useCallback(
    async (id: string, status: string, reason: string, totp_code?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await adminApiClient.updateUserStatus(id, { status, reason, totp_code });
        await fetchUsers();
        if (selectedUser && selectedUser.id === id) {
          const newStatus = (res?.status || status) as UserSummary['status'];
          setSelectedUser((prev) => (prev ? { ...prev, status: newStatus } : null));
        }
        return res;
      } catch (err) {
        setError((err as Error).message || 'Failed to update user status.');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchUsers, selectedUser]
  );

  const fetchUserLedger = useCallback(async (id: string, totp_code?: string) => {
    setIsLedgerLoading(true);
    setError(null);
    try {
      const entries = await adminApiClient.getUserLedger(id, totp_code);
      setLedger(entries);
      return entries;
    } catch (err) {
      setError((err as Error).message || 'Failed to load user ledger.');
      return [];
    } finally {
      setIsLedgerLoading(false);
    }
  }, []);

  return {
    users,
    selectedUser,
    ledger,
    isLoading,
    isDrawerLoading,
    isLedgerLoading,
    error,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    roleFilter,
    setRoleFilter,
    fetchUsers,
    selectUser,
    clearSelectedUser,
    updateUserStatus,
    fetchUserLedger,
  };
}
