// Shared TypeScript types

export interface HealthResponse {
  status: string;
  timestamp: string;
  version: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
}
