import React, { useState } from 'react';
import { MfaStepUpModal } from './MfaStepUpModal';
import { safeFormatNumber } from '@/shared/utils/safeFormatters';
import { Wallet, ShieldAlert, AlertCircle, X } from 'lucide-react';

const FOUR_EYES_THRESHOLD_USD = 500;
const USD_TO_KES_RATE = 130; // Approx rate for display logic ($500 ~ 65,000 KES)

interface WalletAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    user_id: string;
    amount: number;
    currency: string;
    direction: 'credit' | 'debit';
    reason: string;
    idempotency_key?: string;
    totp_code?: string;
  }) => Promise<{ status?: string; pending_four_eyes?: boolean }>;
}

export const WalletAdjustmentModal: React.FC<WalletAdjustmentModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [currency, setCurrency] = useState('KES');
  const [direction, setDirection] = useState<'credit' | 'debit'>('credit');
  const [reason, setReason] = useState('');
  const [isMfaOpen, setIsMfaOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Calculate equivalent USD for threshold warning
  const numericAmount = typeof amount === 'number' ? amount : 0;
  const equivalentUsd = currency === 'USD' ? numericAmount : numericAmount / USD_TO_KES_RATE;
  const triggersFourEyes = equivalentUsd > FOUR_EYES_THRESHOLD_USD;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim()) {
      setError('Target User ID is required.');
      return;
    }
    if (!numericAmount || numericAmount <= 0) {
      setError('Please enter a valid positive adjustment amount.');
      return;
    }
    if (!reason.trim()) {
      setError('Audit rationale/reason is mandatory for manual balance adjustments.');
      return;
    }

    setError(null);
    setIsMfaOpen(true);
  };

  const handleMfaConfirm = async (totpCode: string) => {
    const idempotencyKey = `adj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const res = await onConfirm({
      user_id: userId,
      amount: numericAmount,
      currency,
      direction,
      reason,
      idempotency_key: idempotencyKey,
      totp_code: totpCode,
    });

    if (res?.status === 'pending_second_approval' || res?.pending_four_eyes) {
      setSuccessMessage('Adjustment exceeds threshold ($500 USD) and has been routed to 4-Eyes Super Admin Approval Queue.');
    } else {
      setSuccessMessage('Wallet adjustment executed successfully.');
    }

    setTimeout(() => {
      setSuccessMessage(null);
      onClose();
    }, 2500);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-center">
              <Wallet className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">Manual Wallet Adjustment</h3>
              <p className="text-xs text-slate-400">Super Admin Balance Modification</p>
            </div>
          </div>

          {triggersFourEyes && (
            <div className="mb-4 p-3 bg-amber-500/15 border border-amber-500/30 rounded-lg flex items-center gap-3 text-amber-300 text-xs">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <span className="font-bold uppercase block text-amber-400">Triggers 4-Eyes Approval</span>
                <span>
                  Adjustments exceeding ${FOUR_EYES_THRESHOLD_USD} USD (~65,000 KES) require confirmation by a 2nd Super Admin before execution.
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center gap-2 text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs text-center font-medium">
              {successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Target User ID / UUID
              </label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500/80"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Direction
                </label>
                <select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as 'credit' | 'debit')}
                  className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500/80"
                >
                  <option value="credit">Credit (Add Funds)</option>
                  <option value="debit">Debit (Deduct Funds)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500/80"
                >
                  <option value="KES">KES (Kenyan Shillings)</option>
                  <option value="USD">USD (US Dollar)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Adjustment Amount
              </label>
              <input
                type="number"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="e.g. 50000"
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-100 font-bold focus:outline-none focus:border-blue-500/80"
              />
              <div className="text-[11px] text-slate-500 mt-1">
                Approx USD value: ${safeFormatNumber(equivalentUsd, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Mandatory Reason / Audit Reference
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="State precise reason (e.g. Compensation for platform outage, manual deposit fix)..."
                className="w-full p-3 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/80"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-lg shadow-blue-500/20"
              >
                Proceed to MFA Confirmation
              </button>
            </div>
          </form>
        </div>
      </div>

      <MfaStepUpModal
        isOpen={isMfaOpen}
        onClose={() => setIsMfaOpen(false)}
        onConfirm={handleMfaConfirm}
        title="Wallet Adjustment MFA Authorization"
        description={`Confirm manual ${direction.toUpperCase()} of ${amount} ${currency} for User ${userId}?`}
      />
    </>
  );
};
