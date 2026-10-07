import React from 'react';
import { KycApplication } from '@/services/admin/adminApiClient';
import { safeFormatDate } from '@/shared/utils/safeFormatters';
import { FileSearch, CheckCircle2 } from 'lucide-react';

interface KycQueueTableProps {
  applications: KycApplication[];
  isLoading: boolean;
  onSelectApplication: (app: KycApplication) => void;
}

export const KycQueueTable: React.FC<KycQueueTableProps> = ({
  applications,
  isLoading,
  onSelectApplication,
}) => {
  if (isLoading) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-8 text-center text-slate-400">
        <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
        Loading KYC applications...
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-12 text-center text-slate-400">
        <CheckCircle2 className="w-10 h-10 text-emerald-500/80 mx-auto mb-3" />
        <p className="text-base font-semibold text-slate-200">No KYC applications found</p>
        <p className="text-xs text-slate-500 mt-1">There are no applications matching this status filter.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-xl overflow-hidden shadow-2xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-950/60 border-b border-slate-800/80 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              <th className="py-3.5 px-4">Applicant User</th>
              <th className="py-3.5 px-4">Document Type</th>
              <th className="py-3.5 px-4">Doc / ID Number</th>
              <th className="py-3.5 px-4">Submission Date</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50 text-xs">
            {applications.map((app) => (
              <tr key={app.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="py-3.5 px-4">
                  <div className="font-semibold text-slate-200">{app.user_display_name || app.user_email}</div>
                  <div className="text-[11px] text-slate-400">{app.user_email}</div>
                </td>
                <td className="py-3.5 px-4">
                  <span className="px-2 py-0.5 text-[10px] uppercase font-bold bg-slate-800 text-slate-300 border border-slate-700 rounded">
                    {app.doc_type || 'National ID'}
                  </span>
                </td>
                <td className="py-3.5 px-4 font-mono text-slate-300">
                  {app.doc_number || 'N/A'}
                </td>
                <td className="py-3.5 px-4 text-slate-400">
                  {safeFormatDate(app.submitted_at)}
                </td>
                <td className="py-3.5 px-4">
                  <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full ${
                    app.status === 'approved'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : app.status === 'rejected'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    {app.status}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-right">
                  <button
                    onClick={() => onSelectApplication(app)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-medium transition-colors"
                  >
                    <FileSearch className="w-3.5 h-3.5" />
                    Review Docs
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
