import { apiRequest } from './client';
import type { AuthResponse, AuthUser } from '../types/auth';

export const getCurrentUser = () => apiRequest<AuthUser>('/api/auth/me');

export const passwordLogin = (username: string, password: string) => apiRequest<AuthResponse>('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ username, password }),
});

export const getFeishuAuthorizeUrl = () => apiRequest<{ authorizeUrl: string }>('/api/auth/feishu/authorize');

export const exchangeFeishuTicket = (ticket: string) => apiRequest<AuthResponse>('/api/auth/feishu/exchange', {
  method: 'POST',
  body: JSON.stringify({ ticket }),
});
