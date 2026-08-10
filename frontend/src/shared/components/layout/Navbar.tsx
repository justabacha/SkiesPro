import { Bell, Moon, Sun, User, LogOut, Menu } from 'lucide-react';
import { useTheme } from '@/shared/hooks/useTheme';
import { useAuth } from '@/shared/hooks/useAuth';
import { Button } from '@/shared/components';

interface NavbarProps {
  onMenuClick: () => void;
}

export const Navbar = ({ onMenuClick }: NavbarProps) => {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-border-light bg-bg-light-primary/95 backdrop-blur dark:border-border-dark dark:bg-bg-dark-primary/95">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="inline-flex items-center justify-center rounded-md p-2 lg:hidden text-text-light-secondary hover:bg-bg-light-tertiary dark:text-text-dark-secondary dark:hover:bg-bg-dark-tertiary"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-brand flex items-center justify-center text-white font-bold">S</div>
            <span className="text-xl font-bold font-sans tracking-tight lg:block">SKIESPRO</span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden sm:flex items-center px-3 py-1 rounded-full bg-bg-light-tertiary dark:bg-bg-dark-tertiary">
            <span className="text-xs font-medium text-text-light-secondary dark:text-text-dark-secondary mr-2">BALANCE</span>
            <span className="text-sm font-mono font-bold">$1,250.00</span>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </Button>
            <Button variant="ghost" size="icon">
              <Bell className="h-5 w-5" />
            </Button>

            <div className="relative ml-2 group">
              <button className="flex items-center gap-2 p-1 rounded-full hover:bg-bg-light-tertiary dark:hover:bg-bg-dark-tertiary">
                <div className="h-8 w-8 rounded-full bg-brand-light flex items-center justify-center text-brand font-bold text-xs uppercase">
                  {user?.displayName?.[0] || 'A'}
                </div>
              </button>

              <div className="absolute right-0 mt-2 w-48 origin-top-right rounded-md border border-border-light bg-bg-light-primary py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:border-border-dark dark:bg-bg-dark-secondary hidden group-hover:block">
                <div className="px-4 py-2 border-b border-border-light dark:border-border-dark">
                  <p className="text-sm font-medium">{user?.displayName || 'Amos Ryan'}</p>
                  <p className="text-xs text-text-light-tertiary truncate">{user?.email || 'skiespro.ltd@gmail.com'}</p>
                </div>
                <button className="flex w-full items-center px-4 py-2 text-sm hover:bg-bg-light-tertiary dark:hover:bg-bg-dark-tertiary">
                  <User className="mr-3 h-4 w-4" /> Profile
                </button>
                <button
                  onClick={logout}
                  className="flex w-full items-center px-4 py-2 text-sm text-danger hover:bg-danger-light dark:hover:bg-danger/10"
                >
                  <LogOut className="mr-3 h-4 w-4" /> Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};
