import { apiRequest } from './client';

const encoded = (id) => encodeURIComponent(id);

export const getProjectOptions = () => apiRequest('/api/project-center/project-options');
export const getProjectManagerOptions = () => apiRequest('/api/project-center/manager-options');
export const getDeliveryOwnerOptions = () => apiRequest('/api/project-center/delivery-owner-options');
export const getProjectListOptions = () => Promise.all([
  getProjectOptions(), getProjectManagerOptions(), getDeliveryOwnerOptions(),
]).then(([projects, managers, owners]) => ({ projects, managers, owners }));
export const getLocationOptions = (ids = []) => {
  const query = new URLSearchParams();
  ids.forEach((id) => query.append('ids', id));
  return ids.length ? apiRequest(`/api/project-center/location-options?${query.toString()}`) : Promise.resolve([]);
};
const queryString = (params) => new URLSearchParams(Object.entries(params)
  .filter(([, value]) => value !== '' && value != null)
  .map(([key, value]) => [key, String(value)])).toString();

export const getProjectsPage = (params = {}) => apiRequest(`/api/project-center/projects?${queryString(params)}`);
export const getDeliveryPlansPage = (params = {}) => apiRequest(`/api/project-center/delivery-plans?${queryString(params)}`);
const resourcePage = (path, params = {}) => apiRequest(`${path}?${queryString(params)}`);

export const getProject = (id) => apiRequest(`/api/project-center/projects/${encoded(id)}`);
export const getProjectLocationsPage = (id, params = {}) => resourcePage(`/api/project-center/projects/${encoded(id)}/locations`, params);
export const getProjectDevicesPage = (id, params = {}) => resourcePage(`/api/project-center/projects/${encoded(id)}/devices`, params);
export const getProjectDeliveryPlansPage = (id, params = {}) => resourcePage(`/api/project-center/projects/${encoded(id)}/delivery-plans`, params);
export const getProjectExceptionsPage = (id, params = {}) => resourcePage(`/api/project-center/projects/${encoded(id)}/exceptions`, params);
export const getProjectOperationLogsPage = (id, params = {}) => resourcePage(`/api/project-center/projects/${encoded(id)}/operation-logs`, params);

export const getDeliveryPlan = (id) => apiRequest(`/api/project-center/delivery-plans/${encoded(id)}`);
export const getDeliveryPlanBatchesPage = (id, params = {}) => resourcePage(`/api/project-center/delivery-plans/${encoded(id)}/batches`, params);
export const getDeliveryPlanDevicesPage = (id, params = {}) => resourcePage(`/api/project-center/delivery-plans/${encoded(id)}/devices`, params);
export const getDeliveryPlanExceptionsPage = (id, params = {}) => resourcePage(`/api/project-center/delivery-plans/${encoded(id)}/exceptions`, params);
export const getDeliveryPlanOperationLogsPage = (id, params = {}) => resourcePage(`/api/project-center/delivery-plans/${encoded(id)}/operation-logs`, params);

const batchPath = (planId, batchId) => `/api/project-center/delivery-plans/${encoded(planId)}/batches/${encoded(batchId)}`;
export const getDeliveryBatch = (planId, batchId) => apiRequest(batchPath(planId, batchId));
export const getDeliveryBatchDevicesPage = (planId, batchId, params = {}) => resourcePage(`${batchPath(planId, batchId)}/devices`, params);
export const getDeliveryBatchSiteRecordsPage = (planId, batchId, params = {}) => resourcePage(`${batchPath(planId, batchId)}/site-records`, params);
export const getDeliveryBatchResultRevisionsPage = (planId, batchId, params = {}) => resourcePage(`${batchPath(planId, batchId)}/result-revisions`, params);
export const getDeliveryBatchExceptionsPage = (planId, batchId, params = {}) => resourcePage(`${batchPath(planId, batchId)}/exceptions`, params);
export const getDeliveryBatchErpReferencesPage = (planId, batchId, params = {}) => resourcePage(`${batchPath(planId, batchId)}/erp-references`, params);
export const getDeliveryBatchFeishuLinksPage = (planId, batchId, params = {}) => resourcePage(`${batchPath(planId, batchId)}/feishu-links`, params);
export const getDeliveryBatchOperationLogsPage = (planId, batchId, params = {}) => resourcePage(`${batchPath(planId, batchId)}/operation-logs`, params);

export const createProject = (payload) => apiRequest('/api/project-center/projects', {
  method: 'POST',
  body: JSON.stringify(payload),
});

export const updateProject = (id, payload) => apiRequest(`/api/project-center/projects/${encoded(id)}`, {
  method: 'PATCH',
  body: JSON.stringify(payload),
});

export const createLocation = (payload) => apiRequest('/api/project-center/locations', {
  method: 'POST',
  body: JSON.stringify(payload),
});

export const updateLocation = (id, payload) => apiRequest(`/api/project-center/locations/${encoded(id)}`, {
  method: 'PATCH',
  body: JSON.stringify(payload),
});

export const createDeliveryPlan = (payload) => apiRequest('/api/project-center/delivery-plans', {
  method: 'POST',
  body: JSON.stringify(payload),
});

export const updateDeliveryPlan = (id, payload) => apiRequest(`/api/project-center/delivery-plans/${encoded(id)}`, {
  method: 'PATCH',
  body: JSON.stringify(payload),
});

export const updateDeliveryBatch = (planId, batchId, payload) => apiRequest(batchPath(planId, batchId), {
  method: 'PATCH',
  body: JSON.stringify(payload),
});

export const createDeliveryException = (payload) => apiRequest('/api/project-center/delivery-exceptions', {
  method: 'POST',
  body: JSON.stringify(payload),
});

export const updateDeliveryException = (id, payload) => apiRequest(`/api/project-center/delivery-exceptions/${encoded(id)}`, {
  method: 'PATCH',
  body: JSON.stringify(payload),
});
