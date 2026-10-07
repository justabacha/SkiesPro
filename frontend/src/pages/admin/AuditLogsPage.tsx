import React, { useState } from 'react';
import { useAdminAudit } from '@/hooks/admin/useAdminAudit';
import { safeFormatNumber } from '@/shared/utils/safeFormatters';
import { AuditChainStatusBanner } from '@/components/admin/AuditChainStatusBanner';
import { AuditLogsTable } from '@/components/admin/AuditLogsTable';
import { Search, Filter, AlertCircle } from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const {
    logs,
    total,
    verificationResult,
    isLoading,
    isVerifying,
    error,
    fetchAuditLogs,
    verifyChain,
  } = useAdminAudit();

  const [actorId, setActorId] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAuditLogs({
      actor_id: actorId || undefined,
      action: actionFilter || undefined,
      limit: 50,
    });
  };

  return (
    <div className="space-y-6">
      {/* Cryptographic Chain Banner */}
      <AuditChainStatusBanner
        result={verificationResult}
        isVerifying={isVerifying}
        onVerify={() => verifyChain()}
      />

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-400 text-xs">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <form
        onSubmit={handleApplyFilter}
        className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between"
      >
        <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={actorId}
              onChange={(e) => setActorId(e.target.value)}
              placeholder="Filter by Actor ID / Email..."
              className="w-full pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/80"
            />
          </div>

          <div className="relative w-full md:w-64">
            <Filter className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              placeholder="Filter by Action (e.g. USER_STATUS_CHANGE)..."
              className="w-full pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/80"
            />
          </div>
        </div>

        <button
          type="submit"
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors border border-slate-700 w-full md:w-auto"
        >
          Apply Filters
        </button>
      </form>

      {/* Audit Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase text-slate-300 tracking-wider">
            Immutable Audit Trail Log
          </h2>
          <span className="text-xs text-slate-400 font-mono">Total Log Count: {safeFormatNumber(total)}</span>
        </div>

        <AuditLogsTable logs={logs} isLoading={isLoading} />
      </div>
    </div>
  );
};

export default AuditLogsPage;
