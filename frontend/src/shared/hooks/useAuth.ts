import { useState, useCallback } from 'react';

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
}

export const useAuth = () => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    requiresMfa: false,
    mfaSessionToken: null,
  });

  const login = useCallback(async (data: { email: string }) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      // Mock API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (data.email === 'mfa@example.com') {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          requiresMfa: true,
          mfaSessionToken: 'mock-token'
        }));
        return;
      }

      if (data.email === 'error@example.com') {
        throw new Error('Invalid credentials');
      }

      const mockUser = {
        id: '1',
        email: data.email,
        displayName: 'Amos Ryan',
        role: 'trader',
        kycStatus: 'verified',
      };

      setState({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        requiresMfa: false,
        mfaSessionToken: null,
      });
    } catch (err) {
      setState((prev) => ({ ...prev, isLoading: false, error: (err as Error).message }));
    }
  }, []);

  const register = useCallback(async (data: unknown) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log('Registered with:', data);
      setState((prev) => ({ ...prev, isLoading: false }));
    } catch (err) {
      setState((prev) => ({ ...prev, isLoading: false, error: (err as Error).message }));
    }
  }, []);

  const verifyMfa = useCallback(async (code: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (code !== '123456') throw new Error('Invalid code');

      const mockUser = {
        id: '1',
        email: 'amos@example.com',
        displayName: 'Amos Ryan',
        role: 'trader',
        kycStatus: 'verified',
      };

      setState({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        requiresMfa: false,
        mfaSessionToken: null,
      });
    } catch (err) {
      setState((prev) => ({ ...prev, isLoading: false, error: (err as Error).message }));
    }
  }, []);

  const logout = useCallback(() => {
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      requiresMfa: false,
      mfaSessionToken: null,
    });
  }, []);

  return {
    ...state,
    login,
    register,
    verifyMfa,
    logout,
  };
};
