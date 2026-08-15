import { Bell, Moon, Sun, User, LogOut, Menu, ChevronDown } from 'lucide-react';
import { useTheme } from '@/shared/hooks/useTheme';
import { useAuth } from '@/shared/hooks/useAuth';
import { useWallet } from '@/shared/hooks/useWallet';
import { formatKES } from '@/shared/utils/currencyUtils';
import { Button, Modal, Stack } from '@/shared/components';
import { useState, useRef, useEffect } from 'react';

interface NavbarProps {
  onMenuClick: () => void;
}

export const Navbar = ({ onMenuClick }: NavbarProps) => {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const { balance } = useWallet();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    setIsLogoutModalOpen(false);
    logout();
  };

  return (
    <>
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
              <span className="text-xs font-medium text-text-light-secondary dark:text-text-dark-secondary mr-2 uppercase">KES Balance</span>
              <span className="text-sm font-mono font-bold">{formatKES(balance?.available_balance || '0', false)}</span>
            </div>

            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={toggleTheme}>
                {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              </Button>
              <Button variant="ghost" size="icon">
                <Bell className="h-5 w-5" />
              </Button>

              <div className="relative ml-2" ref={dropdownRef}>
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center gap-2 p-1 rounded-full hover:bg-bg-light-tertiary dark:hover:bg-bg-dark-tertiary transition-colors"
                >
                  <div className="h-8 w-8 rounded-full bg-brand flex items-center justify-center text-white font-bold text-xs uppercase shadow-sm">
                    {user?.displayName?.[0] || 'A'}
                  </div>
                  <ChevronDown className={`h-4 w-4 text-text-light-secondary dark:text-text-dark-secondary transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''}`} />
                </button>

                {isProfileOpen && (
                  <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-md border border-border-light bg-bg-light-primary py-1 shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none dark:border-border-dark dark:bg-bg-dark-secondary z-50">
                    <div className="px-4 py-3 border-b border-border-light dark:border-border-dark">
                      <p className="text-sm font-semibold text-text-light-primary dark:text-text-dark-primary">{user?.displayName || 'User'}</p>
                      <p className="text-xs text-text-light-tertiary truncate mt-0.5">{user?.email}</p>
                    </div>
                    <div className="py-1">
                      <button className="flex w-full items-center px-4 py-2 text-sm text-text-light-secondary dark:text-text-dark-secondary hover:bg-bg-light-tertiary dark:hover:bg-bg-dark-tertiary transition-colors">
                        <User className="mr-3 h-4 w-4" /> Profile
                      </button>
                      <button
                        onClick={() => {
                          setIsProfileOpen(false);
                          setIsLogoutModalOpen(true);
                        }}
                        className="flex w-full items-center px-4 py-2 text-sm text-danger hover:bg-danger-light dark:hover:bg-danger/10 transition-colors"
                      >
                        <LogOut className="mr-3 h-4 w-4" /> Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <Modal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        title="Sign Out"
      >
        <Stack gap="lg">
          <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">
            Are you sure you want to sign out of your SkiesPro account?
          </p>
          <Stack direction="row" gap="md" justify="end">
            <Button variant="ghost" onClick={() => setIsLogoutModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleLogout}>
              Sign Out
            </Button>
          </Stack>
        </Stack>
      </Modal>
    </>
  );
};
