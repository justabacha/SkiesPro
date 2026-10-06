import React, { useState } from 'react';
import { useAdminKyc } from '@/hooks/admin/useAdminKyc';
import { KycQueueTable } from '@/components/admin/KycQueueTable';
import { KycDocumentViewer } from '@/components/admin/KycDocumentViewer';
import { KycDecisionModal } from '@/components/admin/KycDecisionModal';
import { KycApplication } from '@/services/admin/adminApiClient';
import { FileCheck, RefreshCw, AlertCircle } from 'lucide-react';

export const KycReviewPage: React.FC = () => {
  const {
    pendingKyc,
    selectedKyc,
    isLoading,
    error,
    fetchPendingKyc,
    selectKyc,
    clearSelectedKyc,
    reviewKyc,
  } = useAdminKyc();

  const [decisionStatus, setDecisionStatus] = useState<'approved' | 'rejected' | null>(null);

  const handleOpenViewer = (app: KycApplication) => {
    selectKyc(app.id);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-xl p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center">
              <FileCheck className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">KYC Verification & Compliance Panel</h1>
              <p className="text-xs text-slate-400">
                Review submitted identity documents, verify proof of address, and dispatch approval decisions.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => fetchPendingKyc()}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors border border-slate-700 self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Queue
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-400 text-xs">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Queue Table */}
      <KycQueueTable
        applications={pendingKyc}
        isLoading={isLoading}
        onSelectApplication={handleOpenViewer}
      />

      {/* Side-by-side Document Viewer Drawer */}
      <KycDocumentViewer
        application={selectedKyc}
        isOpen={!!selectedKyc && !decisionStatus}
        onClose={clearSelectedKyc}
        onOpenDecisionModal={(status) => setDecisionStatus(status)}
      />

      {/* Decision Modal */}
      <KycDecisionModal
        application={selectedKyc}
        decisionStatus={decisionStatus}
        isOpen={!!decisionStatus}
        onClose={() => setDecisionStatus(null)}
        onConfirm={async (id, status, notes, totpCode) => {
          await reviewKyc(id, status, notes, totpCode);
          setDecisionStatus(null);
        }}
      />
    </div>
  );
};

export default KycReviewPage;
