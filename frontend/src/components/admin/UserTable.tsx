import React from 'react';
import { UserSummary } from '@/services/admin/adminApiClient';
import { safeFormatDate } from '@/shared/utils/safeFormatters';
import { Eye, UserX, ShieldAlert } from 'lucide-react';

interface UserTableProps {
  users: UserSummary[];
  isLoading: boolean;
  onSelectUser: (id: string) => void;
  onChangeStatus: (user: UserSummary) => void;
}

export const UserTable: React.FC<UserTableProps> = ({
  users,
  isLoading,
  onSelectUser,
  onChangeStatus,
}) => {
  if (isLoading) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-8 text-center text-slate-400">
        <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
        Loading user directory...
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-12 text-center text-slate-400">
        <ShieldAlert className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <p className="text-base font-semibold text-slate-300">No users found</p>
        <p className="text-xs text-slate-500 mt-1">Try adjusting your search query or filters.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-xl overflow-hidden shadow-2xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-950/60 border-b border-slate-800/80 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              <th className="py-3.5 px-4">User</th>
              <th className="py-3.5 px-4">Role</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4">KYC Status</th>
              <th className="py-3.5 px-4">Registered</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50 text-xs">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="py-3.5 px-4">
                  <div className="font-semibold text-slate-200">{user.display_name || 'N/A'}</div>
                  <div className="text-[11px] text-slate-400">{user.email}</div>
                </td>
                <td className="py-3.5 px-4">
                  <span className="px-2 py-0.5 text-[10px] uppercase font-bold bg-slate-800 text-slate-300 border border-slate-700 rounded">
                    {user.role}
                  </span>
                </td>
                <td className="py-3.5 px-4">
                  <span
                    className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full ${
                      user.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : user.status === 'suspended'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {user.status}
                  </span>
                </td>
                <td className="py-3.5 px-4">
                  <span className="text-slate-300 font-medium">{user.kyc_status || 'Unverified'}</span>
                </td>
                <td className="py-3.5 px-4 text-slate-400">
                  {safeFormatDate(user.created_at, { dateOnly: true })}
                </td>
                <td className="py-3.5 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onSelectUser(user.id)}
                      className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                      title="Inspect User Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onChangeStatus(user)}
                      className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                      title="Change User Status"
                    >
                      <UserX className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
