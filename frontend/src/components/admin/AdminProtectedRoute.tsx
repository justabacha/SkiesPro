import React from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/shared/hooks/useAuth';
import { AccessDenied } from './AccessDenied';
import { MfaStepUpModal } from './MfaStepUpModal';
import { apiClient } from '@/shared/services/apiClient';
import { AlertCircle } from 'lucide-react';

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
  const storedStepUpToken =
    typeof window !== 'undefined'
      ? window.sessionStorage.getItem('x_admin_mfa_token') ||
        window.sessionStorage.getItem('admin_mfa_token')
      : null;

  const normalizedRoles = (user?.roles || (user?.role ? [user.role] : []))
    .map((role) => role.trim().toLowerCase().replace(/[\s-]+/g, '_'));
  const isStaff = normalizedRoles.some((role) => ALL_ADMIN_ROLES.includes(role));
  const roleMissing = !user?.role && normalizedRoles.length === 0;
  const allowedRoleSet = new Set(allowedRoles.map((role) => role.toLowerCase()));
  const isAllowed = normalizedRoles.some(
    (role) =>
      allowedRoleSet.has(role) ||
      (role === 'risk' && allowedRoleSet.has('risk_manager')) ||
      (role === 'risk_manager' && allowedRoleSet.has('risk'))
  );
  const guardDecision = isLoading
    ? 'waiting_for_auth'
    : !isAuthenticated || !user
      ? 'redirect_to_login'
      : roleMissing
        ? 'blocked_missing_role'
        : !isStaff
          ? 'blocked_non_staff'
          : !isAllowed
            ? 'blocked_insufficient_role'
            : !adminMfaToken
              ? 'open_step_up_modal'
              : 'mount_admin_ui';

  console.info('[GUARD_TRACE] Route Guard Evaluation:', {
    targetPath: location.pathname,
    userId: user?.id,
    extractedRole: user?.role,
    roles: user?.roles,
    mfa_enabled: user?.mfaEnabled,
    stepUpTokenInStorage: !!storedStepUpToken,
    decision: guardDecision,
  });

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

  if (roleMissing) {
    return (
      <DiagnosticBlock reason="Missing staff role in auth state; expected one of SUPER_ADMIN, ADMIN, COMPLIANCE, FINANCE, RISK, or SUPPORT." />
    );
  }

  if (!isStaff) {
    return <DiagnosticBlock reason={`Admin access denied for role: ${user.role}.`} />;
  }

  if (!isAllowed) {
    console.warn('[GUARD_TRACE] Staff role lacks this route permission', {
      targetPath: location.pathname,
      roles: [...normalizedRoles],
      allowedRoles,
    });
    return <AccessDenied requiredRoles={allowedRoles} />;
  }

  if (!adminMfaToken) {
    return (
      <>
        <MfaStepUpModal
          isOpen
          closeOnSuccess={false}
          onClose={() => {
            apiClient.setAdminMfaToken(null);
            navigate('/', { replace: true });
          }}
          onConfirm={async (totpCode) => {
            try {
              const response = await apiClient.post<{
                data?: { admin_mfa_token?: string; stepUpToken?: string };
                stepUpToken?: string;
              }>('/api/v1/auth/admin-mfa/step-up', { totp_code: totpCode });
              const stepUpToken = response.data?.stepUpToken ||
                response.data?.admin_mfa_token ||
                response.stepUpToken;
              console.info('[MFA_TRACE] Step-Up Response:', {
                status: 200,
                tokenReceived: !!stepUpToken,
                rawResponseBody: {
                  ...response,
                  data: response.data
                    ? {
                        ...response.data,
                        admin_mfa_token: response.data.admin_mfa_token ? '[REDACTED]' : undefined,
                        stepUpToken: response.data.stepUpToken ? '[REDACTED]' : undefined,
                      }
                    : undefined,
                  stepUpToken: response.stepUpToken ? '[REDACTED]' : undefined,
                },
              });
              if (!stepUpToken) {
                throw new Error('Step-Up verification succeeded but returned no step-up token.');
              }
              apiClient.setAdminMfaToken(stepUpToken);
              if (!apiClient.getAdminMfaToken()) {
                throw new Error('Step-Up token was not accepted or has expired.');
              }
              setAdminMfaToken(stepUpToken);
            } catch (requestError) {
              const error = requestError as Error & { status?: number; code?: string };
              console.error('[MFA_TRACE] Step-Up Request Failed:', {
                status: error.status,
                code: error.code,
                reason: error.message,
              });
              throw requestError;
            }
          }}
          title="Administrator verification"
          description="Enter your authenticator code to unlock the admin console for five minutes."
        />
      </>
    );
  }

  return <>{children}</>;
};

const DiagnosticBlock: React.FC<{ reason: string }> = ({ reason }) => (
  <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
    <div
      role="alert"
      className="mx-auto mt-16 flex max-w-2xl items-start gap-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-5 text-rose-200"
    >
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <h1 className="font-semibold">Admin route blocked</h1>
        <p className="mt-1 text-sm">REASON: {reason}</p>
        <Link
          to="/dashboard"
          className="mt-4 inline-block rounded bg-slate-800 px-3 py-2 text-sm text-slate-100"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  </main>
);
