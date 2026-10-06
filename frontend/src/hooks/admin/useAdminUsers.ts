import { useState, useCallback, useEffect } from 'react';
import { adminApiClient, UserSummary, UserDetail, UserLedgerEntry } from '@/services/admin/adminApiClient';

export function useAdminUsers() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [ledger, setLedger] = useState<UserLedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
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
      setUsers(data.users || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const selectUser = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const user = await adminApiClient.getUserById(id);
      setSelectedUser(user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateUserStatus = useCallback(
    async (id: string, status: string, reason: string, totp_code?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await adminApiClient.updateUserStatus(id, { status, reason, totp_code });
        await fetchUsers();
        if (selectedUser && selectedUser.id === id) {
          setSelectedUser((prev) => (prev ? { ...prev, status: res.user.status } : null));
        }
        return res;
      } catch (err) {
        setError((err as Error).message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchUsers, selectedUser]
  );

  const fetchUserLedger = useCallback(async (id: string, totp_code?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const entries = await adminApiClient.getUserLedger(id, totp_code);
      setLedger(entries);
      return entries;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    users,
    selectedUser,
    ledger,
    isLoading,
    error,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    roleFilter,
    setRoleFilter,
    fetchUsers,
    selectUser,
    clearSelectedUser: () => setSelectedUser(null),
    updateUserStatus,
    fetchUserLedger,
  };
}
