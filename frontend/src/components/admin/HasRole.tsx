import React from 'react';
import { useAuth } from '@/shared/hooks/useAuth';

export interface HasRoleProps {
  roles: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const HasRole: React.FC<HasRoleProps> = ({ roles, children, fallback = null }) => {
  const { user } = useAuth();
  
  if (!user || !roles.includes(user.role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
