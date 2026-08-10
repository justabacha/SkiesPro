import { NavLink } from 'react-router-dom';
import {
  LayoutGrid,
  LineChart,
  Wallet,
  History,
  Users,
  Settings,
  ShieldCheck,
  Headphones
} from 'lucide-react';
import { clsx } from 'clsx';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutGrid },
  { name: 'Trade', href: '/trade', icon: LineChart },
  { name: 'Wallet', href: '/wallet', icon: Wallet },
  { name: 'History', href: '/history', icon: History },
  { name: 'Referrals', href: '/referrals', icon: Users },
  { name: 'KYC', href: '/kyc', icon: ShieldCheck },
  { name: 'Support', href: '/support', icon: Headphones },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export const Sidebar = () => {
  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col border-r border-border-light dark:border-border-dark bg-bg-light-secondary dark:bg-bg-dark-secondary">
      <div className="flex flex-grow flex-col overflow-y-auto pt-20">
        <nav className="flex-1 space-y-1 px-3 pb-4">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                clsx(
                  'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  isActive
                    ? 'bg-brand text-white'
                    : 'text-text-light-secondary hover:bg-bg-light-tertiary dark:text-text-dark-secondary dark:hover:bg-bg-dark-tertiary'
                )
              }
            >
              <item.icon className="mr-3 h-5 w-5 flex-shrink-0" aria-hidden="true" />
              {item.name}
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  );
};
