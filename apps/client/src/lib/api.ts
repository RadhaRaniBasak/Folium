import type { ApiResponse, AuthResponse, AuthTokens, LoginInput, RegisterInput } from '@shared/types';

const STORAGE_KEY = 'folium_refresh_token';

let _accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  _accessToken = token;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

export function storeRefreshToken(token: string): void {
  localStorage.setItem(STORAGE_KEY, token);
}

export function loadRefreshToken(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function clearRefreshToken(): void {
  localStorage.removeItem(STORAGE_KEY);
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  withAuth = false,
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (withAuth && _accessToken) {
    headers['Authorization'] = `Bearer ${_accessToken}`;
  }

  const res = await fetch(path, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    const message = (body.message as string) ?? (body.error as string) ?? res.statusText;
    throw new Error(message);
  }
  return res.json() as Promise<ApiResponse<T>>;
}

export async function apiRegister(input: RegisterInput): Promise<ApiResponse<AuthResponse>> {
  return request<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function apiLogin(input: LoginInput): Promise<ApiResponse<AuthResponse>> {
  return request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function apiRefresh(refreshToken: string): Promise<ApiResponse<AuthTokens>> {
  return request<AuthTokens>('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}

export async function apiLogout(refreshToken: string): Promise<void> {
  await request('/api/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}

export async function apiGet<T>(path: string): Promise<ApiResponse<T>> {
  return request<T>(path, { method: 'GET' }, true);
}

export async function apiPost<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) }, true);
}

export async function apiPatch<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  return request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }, true);
}

export async function apiDelete<T>(path: string): Promise<ApiResponse<T>> {
  return request<T>(path, { method: 'DELETE' }, true);
}
