/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { exchangeFeishuTicket, getCurrentUser, passwordLogin } from '../api/auth';
import { authStorage } from '../services/authStorage';
import { PROTECTED_ROOT_ROUTES, ROUTES } from '../config/routes';
import type { AuthResponse, AuthUser } from '../types/auth';

interface RoleContextValue {
  ready: boolean;
  currentUser: AuthUser | null;
  currentRole: string;
  isAuthenticated: boolean;
  loginWithFeishuTicket: (ticket: string) => Promise<AuthUser>;
  loginWithPassword: (username: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  canSeeNav: (path: string) => boolean;
  canAccessPath: (path: string) => boolean;
  defaultPath: string;
}

const RoleContext = createContext<RoleContextValue | null>(null);
const FALLBACK_ROLE_PATHS: Record<string, string[]> = {
  管理员: PROTECTED_ROOT_ROUTES,
  普通用户: [ROUTES.home],
  厂长: [ROUTES.home, ROUTES.erpCenter, ROUTES.production, ROUTES.projects, ROUTES.assets],
  项目负责人: [ROUTES.home, ROUTES.projects, ROUTES.assets],
  装配工: [ROUTES.home, ROUTES.production, ROUTES.assets],
  测试员: [ROUTES.home, ROUTES.production, ROUTES.assets],
  质检员: [ROUTES.home, ROUTES.erpCenter, ROUTES.production, ROUTES.assets],
  运维工程师: [ROUTES.home, ROUTES.projects, ROUTES.assets],
  维修工程师: [ROUTES.home, ROUTES.assets],
};

export function RoleProvider({ children }: PropsWithChildren) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(authStorage.getUser);
  const [ready, setReady] = useState(() => !authStorage.getToken());
  const currentRole = currentUser?.role || '';

  const clearSession = () => {
    authStorage.clear();
    setCurrentUser(null);
  };

  useEffect(() => {
    const token = authStorage.getToken();
    if (token) {
      getCurrentUser()
        .then((user) => {
          authStorage.saveUser(user);
          setCurrentUser(user);
        })
        .catch(() => {
          authStorage.clear();
          setCurrentUser(null);
        })
        .finally(() => setReady(true));
    }
    const handleExpired = () => {
      authStorage.clear();
      setCurrentUser(null);
    };
    window.addEventListener('auth-expired', handleExpired);
    return () => window.removeEventListener('auth-expired', handleExpired);
  }, []);

  const saveSession = (response: AuthResponse) => {
    authStorage.save(response.token, response.user);
    setCurrentUser(response.user);
    return response.user;
  };

  const loginWithFeishuTicket = async (ticket) => saveSession(await exchangeFeishuTicket(ticket));
  const loginWithPassword = async (username, password) => saveSession(await passwordLogin(username, password));
  const logout = () => clearSession();
  const allowedPaths = currentUser?.allowedPaths?.length
    ? currentUser.allowedPaths
    : (FALLBACK_ROLE_PATHS[currentRole] || []);
  const canSeeNav = (path) => allowedPaths.includes(path);
  const canAccessPath = (path) => {
    const base = PROTECTED_ROOT_ROUTES.find((item) => path === item || path.startsWith(`${item}/`));
    if (path.startsWith('/devices/')) return allowedPaths.includes(ROUTES.assets);
    if (path.startsWith('/delivery-plans/') || path.startsWith('/projects/')) return allowedPaths.includes(ROUTES.projects);
    return !!base && allowedPaths.includes(base);
  };
  const defaultPath = allowedPaths[0] || ROUTES.login;
  const value: RoleContextValue = {
    ready,
    currentUser,
    currentRole,
    isAuthenticated: !!currentUser,
    loginWithFeishuTicket,
    loginWithPassword,
    logout,
    canSeeNav,
    canAccessPath,
    defaultPath,
  };

  return (
    <RoleContext.Provider value={value}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used within RoleProvider');
  return ctx;
}
