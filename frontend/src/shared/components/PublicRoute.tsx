import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/shared/hooks/useAuth';
import { Spinner } from '@/shared/components';

interface PublicRouteProps {
  children: React.ReactNode;
}

/**
 * Guard for routes that should only be accessible to unauthenticated users (e.g., Login, Register).
 * If the user is authenticated, they are redirected to the home page or the intended destination.
 */
export const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-light-primary dark:bg-bg-dark-primary">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  return <>{children}</>;
};
