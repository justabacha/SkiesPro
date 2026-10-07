import React, { useState } from 'react';
import { useAdminUsers } from '@/hooks/admin/useAdminUsers';
import { UserTable } from '@/components/admin/UserTable';
import { UserDetailDrawer } from '@/components/admin/UserDetailDrawer';
import { UserStatusModal } from '@/components/admin/UserStatusModal';
import { UserSummary } from '@/services/admin/adminApiClient';
import { Search, RefreshCw, Users, AlertCircle } from 'lucide-react';

export const UserManagementPage: React.FC = () => {
  const {
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
  } = useAdminUsers();

  const [statusModalUser, setStatusModalUser] = useState<UserSummary | null>(null);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-xl p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">User Directory & Status Management</h1>
              <p className="text-xs text-slate-400">
                Inspect platform accounts, review wallet balances, and enforce status controls.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchUsers}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors border border-slate-700 self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Directory
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-400 text-xs">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Email, Name, or ID..."
            className="w-full pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/80"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="flex w-full md:w-auto items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500/80"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="banned">Banned</option>
          </select>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500/80"
          >
            <option value="">All Roles</option>
            <option value="trader">Trader</option>
            <option value="admin">Admin</option>
            <option value="super_admin">Super Admin</option>
            <option value="compliance">Compliance</option>
            <option value="finance">Finance</option>
            <option value="support">Support</option>
          </select>
        </div>
      </div>

      {/* User Table */}
      <UserTable
        users={users}
        isLoading={isLoading}
        onSelectUser={selectUser}
        onChangeStatus={(u) => setStatusModalUser(u)}
      />

      {/* Detail Drawer */}
      <UserDetailDrawer
        user={selectedUser}
        ledger={ledger}
        isOpen={!!selectedUser}
        isDrawerLoading={isDrawerLoading}
        isLedgerLoading={isLedgerLoading}
        onClose={clearSelectedUser}
        onFetchLedger={fetchUserLedger}
      />

      {/* Status Modal */}
      <UserStatusModal
        user={statusModalUser}
        isOpen={!!statusModalUser}
        onClose={() => setStatusModalUser(null)}
        onConfirm={async (userId, status, reason, totpCode) => {
          await updateUserStatus(userId, status, reason, totpCode);
        }}
      />
    </div>
  );
};

export default UserManagementPage;
