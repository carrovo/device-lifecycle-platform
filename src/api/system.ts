import { apiRequest } from './client';

export function getUsers(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, String(value));
  });
  const suffix = params.toString() ? `?${params}` : '';
  return apiRequest(`/api/system/users${suffix}`);
}

export const updateUser = (id, payload) => apiRequest(`/api/system/users/${id}`, {
  method: 'PATCH',
  body: JSON.stringify(payload),
});

export const getRoles = () => apiRequest('/api/system/roles');

export function getOperationLogs(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, String(value));
  });
  const suffix = params.toString() ? `?${params}` : '';
  return apiRequest(`/api/system/operation-logs${suffix}`);
}

export const getOperationLogFilters = () => apiRequest('/api/system/operation-logs/filters');

export const createOperationLog = (payload) => apiRequest('/api/operation-logs', {
  method: 'POST',
  body: JSON.stringify(payload),
});
