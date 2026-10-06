import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/shared/hooks/useAuth';
import { AccessDenied } from './AccessDenied';
import { MfaStepUpModal } from './MfaStepUpModal';
import { apiClient } from '@/shared/services/apiClient';

const ALL_ADMIN_ROLES = [
  'support',
  'finance',
  'risk_manager',
  'risk',
  'compliance',
  'admin',
  'super_admin',
];

interface AdminProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const AdminProtectedRoute: React.FC<AdminProtectedRouteProps> = ({
  children,
  allowedRoles = ALL_ADMIN_ROLES,
}) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [adminMfaToken, setAdminMfaToken] = React.useState(() => apiClient.getAdminMfaToken());

  React.useEffect(() => {
    if (!adminMfaToken) return;
    const expiresAt = apiClient.getAdminMfaTokenExpiration();
    if (!expiresAt) {
      setAdminMfaToken(null);
      return;
    }
    const timeout = window.setTimeout(
      () => setAdminMfaToken(null),
      Math.max(0, expiresAt - Date.now())
    );
    return () => window.clearTimeout(timeout);
  }, [adminMfaToken]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0F1117] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-400">Verifying Admin Session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const userRoles = new Set((user.roles || [user.role]).map((role) => role.toLowerCase()));
  const isStaff = [...userRoles].some((role) => ALL_ADMIN_ROLES.includes(role));
  if (!isStaff) {
    return <Navigate to="/" replace />;
  }

  const allowedRoleSet = new Set(allowedRoles.map((role) => role.toLowerCase()));
  const isAllowed = [...userRoles].some(
    (role) =>
      allowedRoleSet.has(role) ||
      (role === 'risk' && allowedRoleSet.has('risk_manager')) ||
      (role === 'risk_manager' && allowedRoleSet.has('risk'))
  );

  if (!isAllowed) {
    return <AccessDenied requiredRoles={allowedRoles} />;
  }

  if (!adminMfaToken) {
    return (
      <>
        <MfaStepUpModal
          isOpen
          onClose={() => {
            apiClient.setAdminMfaToken(null);
            navigate('/', { replace: true });
          }}
          onConfirm={async (totpCode) => {
            const response = await apiClient.post<{
              data: { admin_mfa_token: string };
            }>('/api/v1/auth/admin-mfa/step-up', { totp_code: totpCode });
            apiClient.setAdminMfaToken(response.data.admin_mfa_token);
            setAdminMfaToken(response.data.admin_mfa_token);
          }}
          title="Administrator verification"
          description="Enter your authenticator code to unlock the admin console for five minutes."
        />
      </>
    );
  }

  return <>{children}</>;
};
