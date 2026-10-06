import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { apiClient } from '@/shared/services/apiClient';
import { LoginInput, RegisterInput } from '@/shared/utils/validation/authSchemas';

interface User {
  id: string;
  email: string;
  displayName: string;
  role: string;
  kycStatus: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  requiresMfa: boolean;
  mfaSessionToken: string | null;
  userId: string | null;
  mfaSetupRequired: boolean;
  mfaEnrollmentToken: string | null;
}

interface AuthContextType extends AuthState {
  login: (credentials: LoginInput) => Promise<'mfa' | 'setup' | 'authenticated'>;
  register: (userData: RegisterInput) => Promise<void>;
  verifyMfa: (totp_code: string) => Promise<void>;
  clearMfaEnrollment: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthResponse {
  data: {
    access_token?: string;
    refresh_token?: string;
    requires_mfa?: boolean;
    mfa_session_token?: string;
    mfa_setup_required?: boolean;
    mfa_enrollment_token?: string;
    userId?: string;
    user?: {
      id: string;
      email: string;
      display_name: string;
      role: string;
      kyc_status: string;
    };
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
    requiresMfa: false,
    mfaSessionToken: null,
    userId: null,
    mfaSetupRequired: false,
    mfaEnrollmentToken: null,
  });

  const mapUserResponse = (userData: NonNullable<AuthResponse['data']['user']>): User => ({
    id: userData.id,
    email: userData.email,
    displayName: userData.display_name,
    role: userData.role || 'trader',
    kycStatus: userData.kyc_status,
  });

  const setAuthData = useCallback((data: AuthResponse['data']) => {
    if (data.access_token) {
      apiClient.setAccessToken(data.access_token);
    }

    // Fallback: Store refresh token in localStorage for cross-domain support
    if (data.refresh_token) {
      localStorage.setItem('refresh_token', data.refresh_token);
    }

    if (data.user) {
      setState((prev) => ({
        ...prev,
        user: mapUserResponse(data.user!),
        isAuthenticated: true,
        isLoading: false,
        error: null,
        requiresMfa: false,
        mfaSessionToken: null,
        userId: null,
        mfaSetupRequired: false,
        mfaEnrollmentToken: null,
      }));
      // Clear MFA session if it existed
      sessionStorage.removeItem('mfa_session');
      sessionStorage.removeItem('admin_mfa_enrollment');
    }
  }, []);

  const login = useCallback(async (
    credentials: LoginInput
  ): Promise<'mfa' | 'setup' | 'authenticated'> => {
    apiClient.setAdminMfaToken(null);
    apiClient.setAccessToken(null);
    sessionStorage.removeItem('mfa_session');
    sessionStorage.removeItem('admin_mfa_enrollment');
    localStorage.removeItem('refresh_token');
    setState((prev) => ({
      ...prev,
      user: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,
      requiresMfa: false,
      mfaSessionToken: null,
      userId: null,
      mfaSetupRequired: false,
      mfaEnrollmentToken: null,
    }));
    try {
      const response = await apiClient.post<AuthResponse>('/api/v1/auth/login', credentials);
      const { data } = response;

      if (data.requires_mfa) {
        const mfaData = {
          requiresMfa: true,
          mfaSessionToken: data.mfa_session_token || null,
          userId: data.userId || null,
        };
        setState((prev) => ({
          ...prev,
          isLoading: false,
          user: null,
          isAuthenticated: false,
          mfaSetupRequired: false,
          mfaEnrollmentToken: null,
          ...mfaData,
        }));
        sessionStorage.setItem('mfa_session', JSON.stringify(mfaData));
        return 'mfa';
      }

      if (data.mfa_setup_required && data.mfa_enrollment_token) {
        sessionStorage.removeItem('mfa_session');
        sessionStorage.setItem('admin_mfa_enrollment', data.mfa_enrollment_token);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          user: null,
          isAuthenticated: false,
          requiresMfa: false,
          mfaSetupRequired: true,
          mfaEnrollmentToken: data.mfa_enrollment_token || null,
        }));
        return 'setup';
      }

      setAuthData(data);
      return 'authenticated';
    } catch (err) {
      setState((prev) => ({ ...prev, isLoading: false, error: (err as Error).message }));
      throw err;
    }
  }, [setAuthData]);

  const register = useCallback(async (userData: RegisterInput) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const backendData = {
        email: userData.email,
        password: userData.password,
        display_name: userData.displayName,
        phone: userData.phone,
        referral_code: userData.referralCode,
      };

      await apiClient.post('/api/v1/auth/register', backendData);
      setState((prev) => ({ ...prev, isLoading: false }));
    } catch (err) {
      setState((prev) => ({ ...prev, isLoading: false, error: (err as Error).message }));
      throw err;
    }
  }, []);

  const verifyMfa = useCallback(async (totp_code: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      if (!state.userId) throw new Error('User context missing for MFA');

      const response = await apiClient.post<AuthResponse>('/api/v1/auth/mfa/verify', {
        userId: state.userId,
        totp_code,
      });

      setAuthData(response.data);
    } catch (err) {
      setState((prev) => ({ ...prev, isLoading: false, error: (err as Error).message }));
      throw err;
    }
  }, [state.userId, setAuthData]);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/api/v1/auth/logout');
    } catch (err) {
      console.error('Logout failed', err);
    } finally {
      apiClient.setAccessToken(null);
      apiClient.setAdminMfaToken(null);
      sessionStorage.removeItem('mfa_session');
      sessionStorage.removeItem('admin_mfa_enrollment');
      localStorage.removeItem('refresh_token');
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        requiresMfa: false,
        mfaSessionToken: null,
        userId: null,
        mfaSetupRequired: false,
        mfaEnrollmentToken: null,
      });
    }
  }, []);

  const clearMfaEnrollment = useCallback(() => {
    sessionStorage.removeItem('admin_mfa_enrollment');
    setState((prev) => ({
      ...prev,
      mfaSetupRequired: false,
      mfaEnrollmentToken: null,
    }));
  }, []);

  const refresh = useCallback(async () => {
    try {
      // Send refresh_token from localStorage as body fallback
      const storedToken = localStorage.getItem('refresh_token');
      const response = await apiClient.post<AuthResponse>('/api/v1/auth/refresh', {
        refresh_token: storedToken
      });
      setAuthData(response.data);
    } catch (err) {
      // If refresh fails, it just means no valid session exists
      apiClient.setAccessToken(null);
      apiClient.setAdminMfaToken(null);
      localStorage.removeItem('refresh_token');
      setState((prev) => ({ ...prev, isLoading: false, isAuthenticated: false }));
    }
  }, [setAuthData]);

  const handleUnauthorized = useCallback(() => {
    apiClient.setAccessToken(null);
    localStorage.removeItem('refresh_token');
    sessionStorage.removeItem('mfa_session');
    sessionStorage.removeItem('admin_mfa_enrollment');
    apiClient.setAdminMfaToken(null);
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      requiresMfa: false,
      mfaSessionToken: null,
      userId: null,
      mfaSetupRequired: false,
      mfaEnrollmentToken: null,
    });
  }, []);

  useEffect(() => {
    apiClient.registerUnauthorizedCallback(handleUnauthorized);
    return () => {
      apiClient.registerUnauthorizedCallback(null);
    };
  }, [handleUnauthorized]);

  useEffect(() => {
    // Check for persisted MFA session first
    const persistedMfa = sessionStorage.getItem('mfa_session');
    if (persistedMfa) {
      try {
        const mfaData = JSON.parse(persistedMfa);
        setState((prev) => ({ ...prev, ...mfaData, isLoading: false }));
        return;
      } catch (e) {
        sessionStorage.removeItem('mfa_session');
      }
    }

    const enrollmentToken = sessionStorage.getItem('admin_mfa_enrollment');
    if (enrollmentToken) {
      setState((prev) => ({
        ...prev,
        mfaSetupRequired: true,
        mfaEnrollmentToken: enrollmentToken,
        isLoading: false,
      }));
      return;
    }

    refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider
      value={{ ...state, login, register, verifyMfa, clearMfaEnrollment, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
