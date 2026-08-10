import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';

export const AppLayout = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg-light-primary dark:bg-bg-dark-primary transition-colors duration-200">
      <Navbar onMenuClick={() => setSidebarOpen(!isSidebarOpen)} />

      <div className="flex">
        <Sidebar />

        <main className="flex-1 lg:pl-64 pb-20 lg:pb-0 min-h-[calc(100-64px)]">
          <div className="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>

      <MobileNav />
    </div>
  );
};
