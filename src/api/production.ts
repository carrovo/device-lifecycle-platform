import { apiRequest } from './client';

export const getDevicePage = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== '' && value != null) query.set(key, String(value));
  });
  return apiRequest(`/api/devices?${query.toString()}`);
};

export const getDeviceStats = () => apiRequest('/api/devices/stats');

export const getDeviceTypes = () => apiRequest('/api/devices/types');
export const getProductionDevicePage = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== '' && value != null) query.set(key, String(value));
  });
  return apiRequest(`/api/production/devices?${query.toString()}`);
};
export const getProductionDeviceTypes = () => apiRequest('/api/production/devices/types');
export const getProductionDeviceById = (id) => apiRequest(`/api/production/devices/${encodeURIComponent(id)}`);

export const getDeviceById = (id) => apiRequest(`/api/devices/${encodeURIComponent(id)}`);

export const getDeviceErpLinks = () => apiRequest('/api/devices/erp-links');

export const createProductionDevice = (payload) => apiRequest('/api/production/devices', {
  method: 'POST',
  body: JSON.stringify(payload),
});

export const updateProductionDevice = (id, payload) => apiRequest(`/api/production/devices/${encodeURIComponent(id)}`, {
  method: 'PATCH',
  body: JSON.stringify(payload),
});

export const deleteProductionDevice = (id) => apiRequest(`/api/production/devices/${encodeURIComponent(id)}`, {
  method: 'DELETE',
});
