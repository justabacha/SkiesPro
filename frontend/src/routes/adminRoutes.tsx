import { RouteObject, Navigate } from 'react-router-dom';
import { AdminProtectedRoute } from '@/components/admin/AdminProtectedRoute';
import { UserManagementPage } from '@/pages/admin/UserManagementPage';
import { KycReviewPage } from '@/pages/admin/KycReviewPage';
import { FinanceOverviewPage } from '@/pages/admin/FinanceOverviewPage';
import { FourEyesApprovalPage } from '@/pages/admin/FourEyesApprovalPage';
import { AuditLogsPage } from '@/pages/admin/AuditLogsPage';
import { RiskDashboardPage } from '@/pages/admin/RiskDashboardPage';
import { SupportTicketsPage } from '@/pages/admin/SupportTicketsPage';
import { ReportsDashboardPage } from '@/pages/admin/ReportsDashboardPage';
import { PlatformSettingsPage } from '@/pages/admin/PlatformSettingsPage';

export const adminRoutes: RouteObject[] = [
  {
    index: true,
    element: <Navigate to="/admin/users" replace />,
  },
  {
    path: 'users',
    element: (
      <AdminProtectedRoute allowedRoles={['admin', 'super_admin']}>
        <UserManagementPage />
      </AdminProtectedRoute>
    ),
  },
  {
    path: 'kyc',
    element: (
      <AdminProtectedRoute allowedRoles={['compliance', 'admin', 'super_admin']}>
        <KycReviewPage />
      </AdminProtectedRoute>
    ),
  },
  {
    path: 'finance',
    element: (
      <AdminProtectedRoute allowedRoles={['finance', 'admin', 'super_admin']}>
        <FinanceOverviewPage />
      </AdminProtectedRoute>
    ),
  },
  {
    path: 'approvals',
    element: (
      <AdminProtectedRoute allowedRoles={['super_admin']}>
        <FourEyesApprovalPage />
      </AdminProtectedRoute>
    ),
  },
  {
    path: 'audit',
    element: (
      <AdminProtectedRoute allowedRoles={['compliance', 'admin', 'super_admin']}>
        <AuditLogsPage />
      </AdminProtectedRoute>
    ),
  },
  {
    path: 'risk',
    element: (
      <AdminProtectedRoute allowedRoles={['risk_manager', 'admin', 'super_admin']}>
        <RiskDashboardPage />
      </AdminProtectedRoute>
    ),
  },
  {
    path: 'support',
    element: (
      <AdminProtectedRoute allowedRoles={['support', 'admin', 'super_admin']}>
        <SupportTicketsPage />
      </AdminProtectedRoute>
    ),
  },
  {
    path: 'reports',
    element: (
      <AdminProtectedRoute allowedRoles={['finance', 'admin', 'super_admin']}>
        <ReportsDashboardPage />
      </AdminProtectedRoute>
    ),
  },
  {
    path: 'settings',
    element: (
      <AdminProtectedRoute allowedRoles={['admin', 'super_admin']}>
        <PlatformSettingsPage />
      </AdminProtectedRoute>
    ),
  },
];
