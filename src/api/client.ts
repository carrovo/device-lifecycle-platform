import { APP_CONFIG } from '../config/app';
import { mockApiRequest } from '../mock/server';

export const AUTH_TOKEN_KEY = APP_CONFIG.storageKeys.authToken;
export const AUTH_USER_KEY = APP_CONFIG.storageKeys.authUser;

export async function apiRequest<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  return mockApiRequest<T>(path, options);
}
