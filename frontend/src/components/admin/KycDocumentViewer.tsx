import React from 'react';
import { KycApplication } from '@/services/admin/adminApiClient';
import { X, FileText, UserCheck, CheckCircle2, XCircle } from 'lucide-react';

interface KycDocumentViewerProps {
  application: KycApplication | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenDecisionModal: (status: 'approved' | 'rejected') => void;
}

export const KycDocumentViewer: React.FC<KycDocumentViewerProps> = ({
  application,
  isOpen,
  onClose,
  onOpenDecisionModal,
}) => {
  if (!isOpen || !application) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Top Header */}
        <div className="p-6 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/60">
          <div>
            <h2 className="text-lg font-bold text-slate-100">KYC Application Review</h2>
            <p className="text-xs text-slate-400">
              Applicant: <span className="text-slate-200 font-semibold">{application.user_email}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: Side-by-side Document View */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ID Front */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase">
                <FileText className="w-4 h-4 text-blue-400" />
                ID Document (Front)
              </div>
              <div className="h-48 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex items-center justify-center relative">
                {application.id_front_url ? (
                  <img
                    src={application.id_front_url}
                    alt="ID Front"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-xs text-slate-500 font-mono">Image Not Available / Mock View</div>
                )}
              </div>
            </div>

            {/* ID Back */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase">
                <FileText className="w-4 h-4 text-blue-400" />
                ID Document (Back)
              </div>
              <div className="h-48 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex items-center justify-center relative">
                {application.id_back_url ? (
                  <img
                    src={application.id_back_url}
                    alt="ID Back"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-xs text-slate-500 font-mono">Image Not Available / Mock View</div>
                )}
              </div>
            </div>

            {/* Selfie Verification */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                Biometric Selfie
              </div>
              <div className="h-48 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex items-center justify-center relative">
                {application.selfie_url ? (
                  <img
                    src={application.selfie_url}
                    alt="Selfie"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-xs text-slate-500 font-mono">Selfie Not Available / Mock View</div>
                )}
              </div>
            </div>

            {/* Proof of Address */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase">
                <FileText className="w-4 h-4 text-amber-400" />
                Proof of Address
              </div>
              <div className="h-48 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex items-center justify-center relative">
                {application.proof_of_address_url ? (
                  <img
                    src={application.proof_of_address_url}
                    alt="Proof of Address"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-xs text-slate-500 font-mono">Proof of Address Not Provided</div>
                )}
              </div>
            </div>
          </div>

          {/* Application Metadata */}
          <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Document Type</span>
              <span className="text-slate-200 font-semibold">{application.doc_type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Document Number</span>
              <span className="text-slate-200 font-mono">{application.doc_number || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Submitted At</span>
              <span className="text-slate-200">{new Date(application.submitted_at).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Footer Decision Toolbar */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            onClick={() => onOpenDecisionModal('rejected')}
            className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-semibold transition-colors"
          >
            <XCircle className="w-4 h-4" />
            Reject Application
          </button>
          <button
            onClick={() => onOpenDecisionModal('approved')}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-lg shadow-emerald-600/20"
          >
            <CheckCircle2 className="w-4 h-4" />
            Approve Verification
          </button>
        </div>
      </div>
    </div>
  );
};
