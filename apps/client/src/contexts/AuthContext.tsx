import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { User, LoginInput, RegisterInput } from '@shared/types';
import {
  apiLogin,
  apiLogout,
  apiRefresh,
  apiRegister,
  clearRefreshToken,
  loadRefreshToken,
  setAccessToken,
  storeRefreshToken,
} from '../lib/api';

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

  // On mount, try to restore session from stored refresh token
  useEffect(() => {
    const storedRefreshToken = loadRefreshToken();
    if (!storedRefreshToken) {
      setIsLoading(false);
      return;
    }

    apiRefresh(storedRefreshToken)
      .then((res) => {
        if (res.success && res.data) {
          setAccessToken(res.data.accessToken);
          storeRefreshToken(res.data.refreshToken);
          // Fetch user info with the new access token
          return fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${res.data.accessToken}` },
          }).then((r) => {
            if (!r.ok) throw new Error('Failed to fetch user');
            return r.json() as Promise<{ success: boolean; data?: { user: User } }>;
          });
        }
        return null;
      })
      .then((meRes) => {
        if (meRes?.success && meRes.data?.user) {
          setUser(meRes.data.user);
        } else {
          clearRefreshToken();
        }
      })
      .catch(() => {
        clearRefreshToken();
      })
      .finally(() => {
        setIsLoading(false);
      });
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
