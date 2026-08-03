import { APP_CONFIG } from '../config/app';
import type { AuthUser } from '../types/auth';

const { authToken, authUser } = APP_CONFIG.storageKeys;

export const authStorage = {
  getToken: () => localStorage.getItem(authToken),
  getUser(): AuthUser | null {
    try {
      return JSON.parse(localStorage.getItem(authUser) ?? 'null') as AuthUser | null;
    } catch {
      return null;
    }
  },
  save(token: string, user: AuthUser) {
    localStorage.setItem(authToken, token);
    localStorage.setItem(authUser, JSON.stringify(user));
  },
  saveUser(user: AuthUser) {
    localStorage.setItem(authUser, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(authToken);
    localStorage.removeItem(authUser);
  },
};
