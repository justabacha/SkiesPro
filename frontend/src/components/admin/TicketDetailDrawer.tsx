import React, { useState } from 'react';
import { SupportTicket } from '@/services/admin/adminApiClient';
import { MfaStepUpModal } from './MfaStepUpModal';
import { X, Send, AlertCircle } from 'lucide-react';

interface TicketDetailDrawerProps {
  ticket: SupportTicket | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateTicket: (
    id: string,
    payload: { status?: string; priority?: string; response_message?: string; agent_notes?: string; totp_code?: string }
  ) => Promise<unknown>;
}

export const TicketDetailDrawer: React.FC<TicketDetailDrawerProps> = ({
  ticket,
  isOpen,
  onClose,
  onUpdateTicket,
}) => {
  const [responseMsg, setResponseMsg] = useState('');
  const [status, setStatus] = useState<string>('in_progress');
  const [priority, setPriority] = useState<string>('medium');
  const [isMfaOpen, setIsMfaOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (ticket) {
      setStatus(ticket.status);
      setPriority(ticket.priority);
      setResponseMsg('');
      setError(null);
    }
  }, [ticket]);

  if (!isOpen || !ticket) return null;

  const handleSubmitReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!responseMsg.trim() && status === ticket.status) {
      setError('Please enter a response message or modify ticket status.');
      return;
    }
    setError(null);
    setIsMfaOpen(true);
  };

  const handleMfaConfirm = async (totpCode: string) => {
    await onUpdateTicket(ticket.id, {
      status,
      priority,
      response_message: responseMsg.trim() || undefined,
      totp_code: totpCode,
    });
    setResponseMsg('');
    setIsMfaOpen(false);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/60">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 text-[10px] uppercase font-bold rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  {ticket.category || 'General'}
                </span>
                <span className="text-xs font-mono text-slate-500">#{ticket.id}</span>
              </div>
              <h2 className="text-lg font-bold text-slate-100">{ticket.subject}</h2>
              <p className="text-xs text-slate-400">User: {ticket.user_email}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Controls Bar */}
          <div className="p-4 bg-slate-950/40 border-b border-slate-800 flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Status:</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400">Priority:</span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          {/* Conversation Thread */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {ticket.messages && ticket.messages.length > 0 ? (
              ticket.messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-xl text-xs space-y-1.5 border max-w-[85%] ${
                    msg.sender === 'agent'
                      ? 'ml-auto bg-blue-600/15 border-blue-500/30 text-blue-100'
                      : 'mr-auto bg-slate-950/60 border-slate-800 text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold mb-1">
                    <span>{msg.sender_name || (msg.sender === 'agent' ? 'Support Officer' : 'Customer')}</span>
                    <span>{new Date(msg.created_at).toLocaleTimeString()}</span>
                  </div>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-xs text-slate-500">No message history available.</div>
            )}
          </div>

          {/* Reply Form Footer */}
          <form onSubmit={handleSubmitReply} className="p-4 bg-slate-950 border-t border-slate-800 space-y-3">
            {error && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center gap-2 text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center gap-3">
              <textarea
                rows={2}
                value={responseMsg}
                onChange={(e) => setResponseMsg(e.target.value)}
                placeholder="Type your official response to customer query..."
                className="flex-1 p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 resize-none"
              />
              <button
                type="submit"
                className="px-5 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold transition-colors shadow-lg shadow-cyan-600/20 flex items-center gap-2 shrink-0"
              >
                <Send className="w-4 h-4" />
                Send Reply
              </button>
            </div>
          </form>
        </div>
      </div>

      <MfaStepUpModal
        isOpen={isMfaOpen}
        onClose={() => setIsMfaOpen(false)}
        onConfirm={handleMfaConfirm}
        title="Support Action MFA Verification"
        description={`Update ticket #${ticket.id} status to ${status.toUpperCase()} and dispatch message?`}
      />
    </>
  );
};
