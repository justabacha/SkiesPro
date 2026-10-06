import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/shared/hooks/useAuth';
import {
  Users,
  FileCheck,
  Wallet,
  CheckSquare,
  ShieldCheck,
  TrendingUp,
  Headphones,
  BarChart3,
  Settings,
  ChevronLeft,
  Activity,
} from 'lucide-react';

interface SidebarItem {
  name: string;
  path: string;
  icon: React.ElementType;
  roles: string[];
}

const SIDEBAR_NAV_ITEMS: SidebarItem[] = [
  {
    name: 'User Directory',
    path: '/admin/users',
    icon: Users,
    roles: ['admin', 'super_admin'],
  },
  {
    name: 'KYC Verification',
    path: '/admin/kyc',
    icon: FileCheck,
    roles: ['compliance', 'admin', 'super_admin'],
  },
  {
    name: 'Finance & Wallets',
    path: '/admin/finance',
    icon: Wallet,
    roles: ['finance', 'admin', 'super_admin'],
  },
  {
    name: '4-Eyes Approvals',
    path: '/admin/approvals',
    icon: CheckSquare,
    roles: ['super_admin'],
  },
  {
    name: 'Audit Trail & Chain',
    path: '/admin/audit',
    icon: ShieldCheck,
    roles: ['compliance', 'admin', 'super_admin'],
  },
  {
    name: 'Risk & Exposure',
    path: '/admin/risk',
    icon: TrendingUp,
    roles: ['risk_manager', 'admin', 'super_admin'],
  },
  {
    name: 'Support Tickets',
    path: '/admin/support',
    icon: Headphones,
    roles: ['support', 'admin', 'super_admin'],
  },
  {
    name: 'Reports & Analytics',
    path: '/admin/reports',
    icon: BarChart3,
    roles: ['finance', 'admin', 'super_admin'],
  },
  {
    name: 'Platform Settings',
    path: '/admin/settings',
    icon: Settings,
    roles: ['admin', 'super_admin'],
  },
];

interface AdminSidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ collapsed = false, onToggleCollapse }) => {
  const { user } = useAuth();
  const userRole = user?.role || 'trader';

  // Filter items dynamically by user role
  const visibleItems = SIDEBAR_NAV_ITEMS.filter((item) => item.roles.includes(userRole));

  return (
    <aside
      className={`bg-slate-900/80 backdrop-blur-md border-r border-slate-800/80 flex flex-col transition-all duration-300 z-40 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800/80">
        <NavLink to="/admin" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-bold text-lg">
            S
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-extrabold text-slate-100 tracking-tight text-base leading-none">SkiesPro</span>
              <span className="text-[10px] uppercase tracking-widest text-blue-400 font-semibold mt-1">Admin Console</span>
            </div>
          )}
        </NavLink>

        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg transition-colors hidden lg:block"
          >
            <ChevronLeft className={`w-4 h-4 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {/* Navigation list */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        <div className={`text-[10px] uppercase font-bold text-slate-500 px-3 py-1 ${collapsed ? 'text-center' : ''}`}>
          {collapsed ? '•' : 'Navigation'}
        </div>

        {visibleItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all group ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-md shadow-blue-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                }`
              }
              title={collapsed ? item.name : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer Section */}
      {!collapsed && (
        <div className="p-4 border-t border-slate-800/80">
          <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span className="text-[11px] font-medium text-slate-300">System Normal</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">v1.0.0</span>
          </div>
        </div>
      )}
    </aside>
  );
};
