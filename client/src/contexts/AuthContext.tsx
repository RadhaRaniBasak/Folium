import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User, LoginInput, RegisterInput } from '@shared/types';
import {
  apiLogin,
  apiLogout,
  apiMe,
  apiRegister,
  clearRefreshToken,
  loadRefreshToken,
  onSessionExpired,
  refreshSession,
  setAccessToken,
  storeRefreshToken,
} from '../lib/api';
import { closeSocket } from '../lib/socket';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, try to restore the session from the stored refresh token.
  useEffect(() => {
    onSessionExpired(() => {
      closeSocket();
      setUser(null);
    });

    if (!loadRefreshToken()) {
      setIsLoading(false);
      return;
    }
    refreshSession()
      .then((token) => (token ? apiMe() : null))
      .then((me) => setUser(me))
      .catch(() => clearRefreshToken())
      .finally(() => setIsLoading(false));

    return () => onSessionExpired(null);
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const res = await apiLogin(input);
    if (!res.success || !res.data) {
      throw new Error(res.message ?? res.error ?? 'Login failed');
    }
    setAccessToken(res.data.accessToken);
    storeRefreshToken(res.data.refreshToken);
    setUser(res.data.user);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const res = await apiRegister(input);
    if (!res.success || !res.data) {
      throw new Error(res.message ?? res.error ?? 'Registration failed');
    }
    setAccessToken(res.data.accessToken);
    storeRefreshToken(res.data.refreshToken);
    setUser(res.data.user);
  }, []);

  const logout = useCallback(async () => {
    const storedRefreshToken = loadRefreshToken();
    closeSocket();
    setUser(null);
    setAccessToken(null);
    clearRefreshToken();
    if (storedRefreshToken) {
      await apiLogout(storedRefreshToken).catch(() => {
        // best-effort server-side invalidation
      });
    }
  }, []);

  const value: AuthContextValue = {
    user,
    isAuthenticated: user !== null,
    isLoading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
