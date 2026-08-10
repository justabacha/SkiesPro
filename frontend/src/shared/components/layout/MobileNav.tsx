import { NavLink } from 'react-router-dom';
import {
  LayoutGrid,
  LineChart,
  Wallet,
  History,
  MoreHorizontal
} from 'lucide-react';
import { clsx } from 'clsx';

const mobileNavItems = [
  { name: 'Home', href: '/', icon: LayoutGrid },
  { name: 'Trade', href: '/trade', icon: LineChart },
  { name: 'Wallet', href: '/wallet', icon: Wallet },
  { name: 'History', href: '/history', icon: History },
  { name: 'Menu', href: '/menu', icon: MoreHorizontal },
];

export const MobileNav = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 block border-t border-border-light bg-bg-light-primary dark:border-border-dark dark:bg-bg-dark-primary lg:hidden pb-safe">
      <div className="flex items-center justify-around h-16 px-2">
        {mobileNavItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              clsx(
                'flex flex-col items-center justify-center w-full h-full gap-1 transition-colors',
                isActive
                  ? 'text-brand'
                  : 'text-text-light-tertiary dark:text-text-dark-tertiary'
              )
            }
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[10px] font-medium font-sans uppercase tracking-wider">{item.name}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
