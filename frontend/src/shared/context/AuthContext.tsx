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
}

interface AuthContextType extends AuthState {
  login: (credentials: LoginInput) => Promise<void>;
  register: (userData: RegisterInput) => Promise<void>;
  verifyMfa: (totp_code: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthResponse {
  data: {
    access_token?: string;
    refresh_token?: string;
    requires_mfa?: boolean;
    mfa_session_token?: string;
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
      }));
    }
  }, []);

  const login = useCallback(async (credentials: LoginInput) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await apiClient.post<AuthResponse>('/api/v1/auth/login', credentials);
      const { data } = response;

      if (data.requires_mfa) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          requiresMfa: true,
          mfaSessionToken: data.mfa_session_token || null,
          userId: data.userId || null,
        }));
        return;
      }

      setAuthData(data);
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
      localStorage.removeItem('refresh_token');
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        requiresMfa: false,
        mfaSessionToken: null,
        userId: null,
      });
    }
  }, []);

  const refresh = useCallback(async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      setState((prev) => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      const response = await apiClient.post<AuthResponse>('/api/v1/auth/refresh', {
        refresh_token: refreshToken,
      });
      setAuthData(response.data);
    } catch (err) {
      console.error('Token refresh failed', err);
      localStorage.removeItem('refresh_token');
      apiClient.setAccessToken(null);
      setState((prev) => ({ ...prev, isLoading: false, isAuthenticated: false }));
    }
  }, [setAuthData]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ ...state, login, register, verifyMfa, logout }}>
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
