import React from 'react';
import { AuditLogItem } from '@/services/admin/adminApiClient';
import { formatDateEAT, formatLabel } from '@/shared/utils/safeFormatters';
import { TableLoading, TableEmpty } from '@/shared/components';
import { ShieldCheck } from 'lucide-react';

interface AuditLogsTableProps {
  logs: AuditLogItem[];
  isLoading: boolean;
}

export const AuditLogsTable: React.FC<AuditLogsTableProps> = ({ logs, isLoading }) => {
  if (isLoading) {
    return <TableLoading message="Loading immutable audit log ledger..." />;
  }

  if (logs.length === 0) {
    return (
      <TableEmpty
        icon={ShieldCheck}
        title="No Audit Trail Records"
        description="No administrative events recorded matching current filter parameters."
      />
    );
  }

  return (
    <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-xl overflow-hidden shadow-2xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-950/60 border-b border-slate-800/80 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              <th className="py-3.5 px-4">Actor</th>
              <th className="py-3.5 px-4">Action</th>
              <th className="py-3.5 px-4">Target Entity</th>
              <th className="py-3.5 px-4">SHA-256 Hash Badge</th>
              <th className="py-3.5 px-4">Timestamp (EAT)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50 text-xs">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="py-3.5 px-4">
                  <div className="font-semibold text-slate-200">{log.actor_email || log.actor_id}</div>
                  {log.ip_address && <div className="text-[10px] text-slate-500 font-mono">IP: {log.ip_address}</div>}
                </td>
                <td className="py-3.5 px-4">
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {formatLabel(log.action)}
                  </span>
                </td>
                <td className="py-3.5 px-4 font-mono text-slate-300">
                  {formatLabel(log.target_entity)} {log.target_id ? `(${log.target_id.substring(0, 8)}...)` : ''}
                </td>
                <td className="py-3.5 px-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-[10px] px-2 py-0.5 bg-slate-950 text-emerald-400 border border-emerald-500/30 rounded w-fit">
                      {log.entry_hash ? `${log.entry_hash.substring(0, 8)}...${log.entry_hash.substring(log.entry_hash.length - 8)}` : 'N/A'}
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono">
                      Prev: {log.previous_entry_hash ? `${log.previous_entry_hash.substring(0, 6)}...` : 'GENESIS'}
                    </span>
                  </div>
                </td>
                <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                  {formatDateEAT(log.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
