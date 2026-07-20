/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react';
import { ROLE_NAV_PERMISSIONS, ROLE_ACTION_PERMISSIONS } from '../data/mockData';

const RoleContext = createContext(null);

export function RoleProvider({ children }) {
  const [currentRole, setCurrentRole] = useState('管理员');
  const [actionPermissions, setActionPermissions] = useState({ ...ROLE_ACTION_PERMISSIONS });
  const [navPermissions, setNavPermissions] = useState(() =>
    Object.fromEntries(Object.entries(ROLE_NAV_PERMISSIONS).map(([k, v]) => [k, [...v]]))
  );

  const canSeeNav = (path) => (navPermissions[currentRole] || []).includes(path);
  const canDo = (action) => (actionPermissions[currentRole] || []).includes(action);

  const updateActionPermission = (role, action, hasPermission) => {
    setActionPermissions((prev) => {
      const perms = prev[role] || [];
      return { ...prev, [role]: hasPermission ? [...perms, action] : perms.filter((a) => a !== action) };
    });
  };

  const updateNavPermission = (role, path, hasPermission) => {
    setNavPermissions((prev) => {
      const perms = prev[role] || [];
      return { ...prev, [role]: hasPermission ? [...perms, path] : perms.filter((p) => p !== path) };
    });
  };

  return (
    <RoleContext.Provider value={{ currentRole, setCurrentRole, canSeeNav, canDo, actionPermissions, updateActionPermission, navPermissions, updateNavPermission }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used within RoleProvider');
  return ctx;
}
