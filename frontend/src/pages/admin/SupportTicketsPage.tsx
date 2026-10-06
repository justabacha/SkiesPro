import React from 'react';
import { useAdminSupport } from '@/hooks/admin/useAdminSupport';
import { TicketDetailDrawer } from '@/components/admin/TicketDetailDrawer';
import { Headphones, RefreshCw, MessageSquare, AlertCircle } from 'lucide-react';

export const SupportTicketsPage: React.FC = () => {
  const {
    tickets,
    selectedTicket,
    isLoading,
    error,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    fetchTickets,
    selectTicket,
    clearSelectedTicket,
    updateTicket,
  } = useAdminSupport();

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-xl p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-500/10 border border-cyan-500/20 rounded-xl flex items-center justify-center">
              <Headphones className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">Customer Support Ticket Management</h1>
              <p className="text-xs text-slate-400">
                Inbox for support staff to manage inquiries, update priority tiers, and dispatch responses.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => fetchTickets()}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors border border-slate-700 self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Inbox
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-400 text-xs">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-xl p-4 flex items-center gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500/80"
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500/80"
        >
          <option value="">All Priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>

      {/* Tickets List */}
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/60 border-b border-slate-800/80 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                <th className="py-3.5 px-4">Subject & User</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Priority</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Updated At</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-xs">
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-100">{ticket.subject}</div>
                    <div className="text-[11px] text-slate-400">{ticket.user_email}</div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-300 capitalize">
                    {ticket.category || 'General'}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                        ticket.priority === 'urgent'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : ticket.priority === 'high'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {ticket.priority}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full ${
                        ticket.status === 'open'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : ticket.status === 'in_progress'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      {ticket.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                    {ticket.updated_at ? new Date(ticket.updated_at).toLocaleString() : 'N/A'}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => selectTicket(ticket.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 border border-cyan-500/30 rounded-lg text-xs font-medium transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Open Drawer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ticket Drawer */}
      <TicketDetailDrawer
        ticket={selectedTicket}
        isOpen={!!selectedTicket}
        onClose={clearSelectedTicket}
        onUpdateTicket={updateTicket}
      />
    </div>
  );
};

export default SupportTicketsPage;
