import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/shared/components/layout/AppLayout';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { MfaPage } from '@/pages/auth/MfaPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { Placeholder } from '@/shared/components/Placeholder';
import { ProtectedRoute } from '@/shared/components/ProtectedRoute';
import DesignSystemPage from '@/pages/DesignSystem';

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Placeholder title="Dashboard" /> },
      { path: 'trade', element: <Placeholder title="Trading Engine" /> },
      { path: 'wallet', element: <Placeholder title="Wallet & Payments" /> },
      { path: 'history', element: <Placeholder title="Trade History" /> },
      { path: 'referrals', element: <Placeholder title="Referral System" /> },
      { path: 'kyc', element: <Placeholder title="KYC Verification" /> },
      { path: 'support', element: <Placeholder title="Support Tickets" /> },
      { path: 'settings', element: <Placeholder title="User Settings" /> },
      { path: 'design-system', element: <DesignSystemPage /> },
      { path: 'menu', element: <Placeholder title="Mobile Menu" /> },
    ],
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    path: '/verify-otp',
    element: <MfaPage />,
  },
  {
    path: '/forgot-password',
    element: <ForgotPasswordPage />,
  },
  {
    path: '/reset-password',
    element: <ResetPasswordPage />,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
