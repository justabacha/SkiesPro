import React from 'react';
import { useAuth } from '@/shared/hooks/useAuth';
import { ShieldCheck, Search, LogOut, Menu } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

interface AdminHeaderProps {
  onToggleSidebar?: () => void;
}

const ROLE_COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  super_admin: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  admin: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  finance: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  compliance: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  risk_manager: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
  support: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
};

export const AdminHeader: React.FC<AdminHeaderProps> = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const role = user?.role.toLowerCase() || 'admin';
  const roleStyle = ROLE_COLOR_MAP[role] || ROLE_COLOR_MAP.admin;

  // Format path for breadcrumbs
  const pathSegments = location.pathname.split('/').filter(Boolean);

  return (
    <header className="h-16 bg-slate-900/60 backdrop-blur-md border-b border-slate-800/80 px-4 md:px-6 flex items-center justify-between flex-shrink-0 w-full z-30">
      <div className="flex items-center gap-4">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-2 text-slate-400 hover:text-slate-200 lg:hidden rounded-lg hover:bg-slate-800/50"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Breadcrumbs */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
          <span className="font-semibold text-slate-300">SkiesPro Admin</span>
          {pathSegments.map((segment, idx) => (
            <React.Fragment key={idx}>
              <span>/</span>
              <span className={idx === pathSegments.length - 1 ? 'text-blue-400 font-medium capitalize' : 'capitalize'}>
                {segment.replace(/-/g, ' ')}
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Global Quick Search */}
      <div className="flex-1 max-w-md mx-4 hidden md:block">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Quick search users, tickets, transactions..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-950/60 border border-slate-800/80 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/80 transition-colors"
          />
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-4">
        {/* MFA Status Indicator */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[11px] text-emerald-400 font-medium"
          title="MFA Token Active"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">MFA Active</span>
        </div>

        {/* Active Profile & Role Badge */}
        <div className="flex items-center gap-3 border-l border-slate-800/80 pl-4">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-semibold text-xs">
            {user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'A'}
          </div>
          <div className="hidden lg:block text-left">
            <div className="text-xs font-semibold text-slate-200">{user?.displayName || user?.email}</div>
            <div className="flex items-center gap-1">
              <span className={`px-1.5 py-0.5 text-[10px] uppercase font-bold rounded border ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border}`}>
                {role}
              </span>
            </div>
          </div>

          {/* Logout button */}
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors ml-1"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
