import type {
  ApiResponse,
  AuthResponse,
  AuthTokens,
  LoginInput,
  PageSummary,
  RegisterInput,
  SearchResult,
  UpdatePageInput,
  User,
  Workspace,
  WorkspaceDetail,
  WorkspaceRole,
} from '@shared/types';

const STORAGE_KEY = 'folium_refresh_token';

let _accessToken: string | null = null;
let _refreshing: Promise<string | null> | null = null;
let _onSessionExpired: (() => void) | null = null;

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

/** Called when the refresh token is rejected, so the app can sign out. */
export function onSessionExpired(handler: (() => void) | null): void {
  _onSessionExpired = handler;
}

function expiresAt(token: string): number {
  try {
    const payload = token.split('.')[1] ?? '';
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
      exp?: number;
    };
    return (json.exp ?? 0) * 1000;
  } catch {
    return 0;
  }
}

async function doRefresh(): Promise<string | null> {
  const token = loadRefreshToken();
  if (!token) return null;
  try {
    const res = await apiRefresh(token);
    if (!res.data) throw new Error('Refresh failed');
    setAccessToken(res.data.accessToken);
    storeRefreshToken(res.data.refreshToken);
    return res.data.accessToken;
  } catch {
    // Another tab may have rotated the token meanwhile — retry once with the new one.
    const latest = loadRefreshToken();
    if (latest && latest !== token) return doRefresh();
    setAccessToken(null);
    clearRefreshToken();
    _onSessionExpired?.();
    return null;
  }
}

/** Exchanges the refresh token for a new access token (deduplicated). */
export function refreshSession(): Promise<string | null> {
  _refreshing ??= doRefresh().finally(() => {
    _refreshing = null;
  });
  return _refreshing;
}

/** A valid access token, refreshed shortly before it expires. */
export async function getFreshAccessToken(): Promise<string | null> {
  if (_accessToken && expiresAt(_accessToken) - Date.now() > 30_000) return _accessToken;
  return refreshSession();
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  withAuth = false,
  isRetry = false,
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (withAuth) {
    const token = await getFreshAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(path, { ...options, headers });
  if (res.status === 401 && withAuth && !isRetry && (await refreshSession())) {
    return request<T>(path, options, withAuth, true);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const message = (body.message as string) ?? (body.error as string) ?? res.statusText;
    throw new Error(message);
  }
  return res.json() as Promise<ApiResponse<T>>;
}

function unwrap<T>(res: ApiResponse<T>): T {
  if (!res.data) throw new Error(res.message ?? 'Request failed');
  return res.data;
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

export async function apiMe(): Promise<User> {
  return unwrap(await apiGet<{ user: User }>('/api/auth/me')).user;
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

export async function apiPut<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  return request<T>(path, { method: 'PUT', body: JSON.stringify(body) }, true);
}

export async function apiDelete<T>(path: string): Promise<ApiResponse<T>> {
  return request<T>(path, { method: 'DELETE' }, true);
}

export const Workspaces = {
  list: async () => unwrap(await apiGet<{ workspaces: Workspace[] }>('/api/workspaces')).workspaces,
  create: async (name: string) =>
    unwrap(await apiPost<{ workspace: Workspace }>('/api/workspaces', { name })).workspace,
  detail: async (id: string) =>
    unwrap(await apiGet<{ workspace: WorkspaceDetail }>(`/api/workspaces/${id}`)).workspace,
  invite: (id: string, email: string, role: WorkspaceRole) =>
    apiPost(`/api/workspaces/${id}/members`, { email, role }),
  setRole: (id: string, userId: string, role: WorkspaceRole) =>
    apiPatch(`/api/workspaces/${id}/members/${userId}`, { role }),
  removeMember: (id: string, userId: string) =>
    apiDelete(`/api/workspaces/${id}/members/${userId}`),
};

export const Pages = {
  list: async (workspaceId: string, trash = false) =>
    unwrap(
      await apiGet<{ pages: PageSummary[] }>(
        `/api/workspaces/${workspaceId}/pages${trash ? '?trash=1' : ''}`,
      ),
    ).pages,
  create: async (
    workspaceId: string,
    input: { title?: string; parent?: string | null; icon?: string },
  ) =>
    unwrap(await apiPost<{ page: PageSummary }>(`/api/workspaces/${workspaceId}/pages`, input))
      .page,
  get: async (id: string) =>
    unwrap(await apiGet<{ page: PageSummary; role: WorkspaceRole }>(`/api/pages/${id}`)),
  update: async (id: string, patch: UpdatePageInput) =>
    unwrap(await apiPatch<{ page: PageSummary }>(`/api/pages/${id}`, patch)).page,
  favorite: async (id: string) =>
    unwrap(await apiPost<{ page: PageSummary }>(`/api/pages/${id}/favorite`, {})).page,
  duplicate: async (id: string) =>
    unwrap(await apiPost<{ page: PageSummary }>(`/api/pages/${id}/duplicate`, {})).page,
  trash: (id: string) => apiDelete(`/api/pages/${id}`),
  restore: async (id: string) =>
    unwrap(await apiPost<{ page: PageSummary }>(`/api/pages/${id}/restore`, {})).page,
  destroy: (id: string) => apiDelete(`/api/pages/${id}/permanent`),
  search: async (workspaceId: string, q: string) =>
    unwrap(
      await apiGet<{ results: SearchResult[] }>(
        `/api/workspaces/${workspaceId}/search?q=${encodeURIComponent(q)}`,
      ),
    ).results,
  /** Snapshot of the editor document → block records + search text. */
  saveBlocks: (id: string, blocks: unknown[]) => apiPut(`/api/pages/${id}/blocks`, { blocks }),
};
