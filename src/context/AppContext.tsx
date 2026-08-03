/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useReducer, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useRole } from './RoleContext';
import { createOperationLog, getOperationLogs } from '../api/system';
import { getBusinessDictionaries } from '../api/dictionaries';
import { configureProductionSteps } from '../data/prdV12';
import {
  createProductionDevice,
  deleteProductionDevice,
  getDeviceById,
  getDeviceErpLinks,
  getDeviceTypes,
  getProductionDeviceById,
  getProductionDeviceTypes,
  updateProductionDevice,
} from '../api/production';
import {
  createDeliveryException,
  createDeliveryPlan,
  createLocation,
  createProject,
  getDeliveryPlan,
  getDeliveryPlanBatchesPage,
  getDeliveryPlanDevicesPage,
  getDeliveryPlanExceptionsPage,
  getDeliveryPlanOperationLogsPage,
  getDeliveryBatchDevicesPage,
  getDeliveryBatchExceptionsPage,
  getDeliveryBatchErpReferencesPage,
  getDeliveryBatchFeishuLinksPage,
  getDeliveryBatchOperationLogsPage,
  getDeliveryBatchSiteRecordsPage,
  getProject,
  getProjectDeliveryPlansPage,
  getProjectDevicesPage,
  getProjectExceptionsPage,
  getProjectLocationsPage,
  getProjectOperationLogsPage,
  updateDeliveryException,
  updateDeliveryBatch,
  updateDeliveryPlan,
  updateLocation,
  updateProject,
} from '../api/projectCenter';

const AppContext = createContext<any>(null);
const arrayOrEmpty = (value) => Array.isArray(value) ? value : [];

const normalizeDevice = (device: Record<string, any> = {}): any => ({
  ...device,
  deliveryPlanIds: arrayOrEmpty(device.deliveryPlanIds),
  productionHistory: arrayOrEmpty(device.productionHistory),
  otherFeishuTables: arrayOrEmpty(device.otherFeishuTables),
  erpInboundLinks: arrayOrEmpty(device.erpInboundLinks),
});

const normalizeBatch = (batch: Record<string, any> = {}) => ({
  ...batch,
  deviceRelations: arrayOrEmpty(batch.deviceRelations).map((relation) => ({
    ...relation,
    resultHistory: arrayOrEmpty(relation?.resultHistory),
  })),
  erpReferences: arrayOrEmpty(batch.erpReferences),
  feishuLinks: arrayOrEmpty(batch.feishuLinks),
  siteRecords: arrayOrEmpty(batch.siteRecords).map((record) => ({
    ...record,
    deviceIds: arrayOrEmpty(record?.deviceIds),
  })),
});

const normalizePlan = (plan: Record<string, any> = {}) => ({
  ...plan,
  batches: arrayOrEmpty(plan.batches).map(normalizeBatch),
});

function applyDeliveryMemberships(devices, plans) {
  const memberships = new Map<any, any[]>();
  arrayOrEmpty(plans).forEach((plan) => {
    (plan.batches || []).forEach((batch) => {
      (batch.deviceRelations || []).forEach((relation) => {
        const current = memberships.get(relation.deviceId) || [];
        memberships.set(relation.deviceId, [...current, { planId: plan.id, batchId: batch.id }]);
      });
    });
  });
  return arrayOrEmpty(devices).map(normalizeDevice).map((device) => {
    const linked = memberships.get(device.id) || [];
    return {
      ...device,
      deliveryPlanId: linked[0]?.planId || null,
      deliveryPlanIds: [...new Set(linked.map((item) => item.planId))],
      deliveryBatchId: linked[0]?.batchId || null,
    };
  });
}

const normalizeDevices = (devices) => arrayOrEmpty(devices).map(normalizeDevice);
const allPage = { page: 1, size: 100 };

async function loadProjectResources(id, tab = 'overview') {
  const [project, deviceTypes] = await Promise.all([getProject(id), getDeviceTypes()]);
  let locations = { items: [] };
  let devices = { items: [] };
  let plans = { items: [] };
  let exceptions = { items: [] };
  let logs = { items: [] };
  if (tab === 'locations') {
    [locations, devices] = await Promise.all([
      getProjectLocationsPage(id, allPage),
      getProjectDevicesPage(id, allPage),
    ]);
  } else if (tab === 'delivery') {
    [plans, exceptions, devices] = await Promise.all([
      getProjectDeliveryPlansPage(id, allPage),
      getProjectExceptionsPage(id, allPage),
      getProjectDevicesPage(id, allPage),
    ]);
  } else if (tab === 'logs') {
    logs = await getProjectOperationLogsPage(id, allPage);
  }
  return {
    projects: [project], locations: locations.items, devices: devices.items,
    deliveryPlans: plans.items, deliveryExceptions: exceptions.items,
    operationLogs: arrayOrEmpty(logs.items).map((item) => ({
      ...item,
      projectId: id,
      timestamp: item.timestamp || item.time,
      actionType: item.actionType || item.action,
    })), deviceTypes,
  };
}

async function loadDeliveryResources(id, requestedBatchId = '') {
  const [plan, batchesPage, exceptions, planLogs, deviceTypes] = await Promise.all([
    getDeliveryPlan(id),
    getDeliveryPlanBatchesPage(id, allPage),
    requestedBatchId
      ? getDeliveryBatchExceptionsPage(id, requestedBatchId, allPage)
      : getDeliveryPlanExceptionsPage(id, allPage),
    requestedBatchId ? Promise.resolve({ items: [] }) : getDeliveryPlanOperationLogsPage(id, allPage),
    getDeviceTypes(),
  ]);
  const [project, locations, projectDevices, relations, batchDetail] = await Promise.all([
    getProject(plan.projectId),
    getProjectLocationsPage(plan.projectId, allPage),
    requestedBatchId ? Promise.resolve({ items: [] }) : getProjectDevicesPage(plan.projectId, allPage),
    requestedBatchId
      ? getDeliveryBatchDevicesPage(id, requestedBatchId, allPage)
      : getDeliveryPlanDevicesPage(id, allPage),
    requestedBatchId ? Promise.all([
      getDeliveryBatchSiteRecordsPage(id, requestedBatchId, allPage),
      getDeliveryBatchErpReferencesPage(id, requestedBatchId, allPage),
      getDeliveryBatchFeishuLinksPage(id, requestedBatchId, allPage),
      getDeliveryBatchOperationLogsPage(id, requestedBatchId, allPage),
    ]) : Promise.resolve(null),
  ]);
  const devicesById = new Map();
  arrayOrEmpty(projectDevices.items).forEach((device) => devicesById.set(device.id, device));
  arrayOrEmpty(relations.items).map((item) => item.device).filter(Boolean)
    .forEach((device) => devicesById.set(device.id, device));
  const relationsByBatch = new Map();
  arrayOrEmpty(relations.items).forEach((item) => {
    const batchId = item.batch?.id;
    if (!batchId) return;
    const relation = { ...item };
    delete relation.device;
    delete relation.batch;
    relationsByBatch.set(batchId, [...(relationsByBatch.get(batchId) || []), relation]);
  });
  const batches = arrayOrEmpty(batchesPage.items).map((summary) => {
    const isRequested = summary.id === requestedBatchId;
    return {
      ...summary,
      deviceRelations: relationsByBatch.get(summary.id) || [],
      siteRecords: isRequested ? arrayOrEmpty(batchDetail?.[0]?.items) : [],
      erpReferences: isRequested ? arrayOrEmpty(batchDetail?.[1]?.items) : [],
      feishuLinks: isRequested ? arrayOrEmpty(batchDetail?.[2]?.items) : [],
      operationLogs: isRequested ? arrayOrEmpty(batchDetail?.[3]?.items) : [],
    };
  });
  return {
    projects: [project], locations: locations.items, devices: [...devicesById.values()], deviceTypes,
    deliveryPlans: [{ ...plan, batches }],
    deliveryExceptions: exceptions.items,
    operationLogs: requestedBatchId ? arrayOrEmpty(batchDetail?.[3]?.items) : planLogs.items,
  };
}

const initialState = {
  devices: [],
  deviceTypes: [],
  operationLogs: [],
  projects: [],
  deliveryPlans: [],
  locations: [],
  deliveryExceptions: [],
  users: [],
  currentUser: '',
  currentUserId: '',
  productionLoading: false,
  productionError: '',
  projectCenterLoading: false,
  projectCenterError: '',
  projectTypes: [],
  productionSteps: [],
};

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_AUTH_USER':
      return {
        ...state,
        currentUser: action.payload?.name || '',
        currentUserId: action.payload?.id || '',
      };

    case 'SET_DICTIONARIES':
      return {
        ...state,
        projectTypes: arrayOrEmpty(action.payload?.projectTypes).map((item) => item.name),
        productionSteps: arrayOrEmpty(action.payload?.productionNodes),
      };

    case 'SET_PRODUCTION_LOADING':
      return { ...state, productionLoading: action.payload, productionError: '' };

    case 'SET_PRODUCTION_DATA':
      return {
        ...state,
        devices: normalizeDevices(applyDeliveryMemberships(action.payload?.devices, state.deliveryPlans)),
        deviceTypes: arrayOrEmpty(action.payload?.deviceTypes),
        operationLogs: arrayOrEmpty(action.payload?.operationLogs),
        productionLoading: false,
        productionError: '',
      };

    case 'SET_DEVICE_REFERENCES':
      return { ...state, devices: normalizeDevices(action.payload) };

    case 'SET_PRODUCTION_ERROR':
      return { ...state, productionLoading: false, productionError: action.payload };

    case 'SET_PROJECT_CENTER_LOADING':
      return { ...state, projectCenterLoading: action.payload, projectCenterError: '' };

    case 'SET_PROJECT_CENTER_DATA': {
      const plans = arrayOrEmpty(action.payload?.deliveryPlans).map(normalizePlan);
      const contextDevices = Array.isArray(action.payload?.devices) ? action.payload.devices : state.devices;
      return {
        ...state,
        projects: arrayOrEmpty(action.payload?.projects),
        locations: arrayOrEmpty(action.payload?.locations),
        deliveryPlans: plans,
        deliveryExceptions: arrayOrEmpty(action.payload?.deliveryExceptions).map((item) => ({
          ...item,
          affectedDeviceIds: arrayOrEmpty(item?.affectedDeviceIds),
        })),
        devices: normalizeDevices(applyDeliveryMemberships(contextDevices, plans)),
        deviceTypes: Array.isArray(action.payload?.deviceTypes) ? action.payload.deviceTypes : state.deviceTypes,
        operationLogs: Array.isArray(action.payload?.operationLogs) ? action.payload.operationLogs : state.operationLogs,
        projectCenterLoading: false,
        projectCenterError: '',
      };
    }

    case 'SET_PROJECT_CENTER_ERROR':
      return { ...state, projectCenterLoading: false, projectCenterError: action.payload };

    case 'UPDATE_USER':
      return {
        ...state,
        users: state.users.map((user) =>
          user.id === action.payload.id ? { ...user, ...action.payload } : user
        ),
      };

    case 'ADD_DEVICE':
      return { ...state, devices: [...state.devices, normalizeDevice(action.payload)] };

    case 'UPDATE_DEVICE':
      return {
        ...state,
        devices: state.devices.map((d) =>
          d.id === action.payload.id ? normalizeDevice({ ...d, ...action.payload }) : d
        ),
      };

    case 'DELETE_DEVICE':
      return {
        ...state,
        devices: state.devices.filter((d) => d.id !== action.payload),
      };

    case 'ADD_OPERATION_LOG':
      return { ...state, operationLogs: [...state.operationLogs, action.payload] };

    case 'ADD_PROJECT':
      return { ...state, projects: [...state.projects, action.payload] };

    case 'UPDATE_PROJECT':
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.payload.id ? { ...p, ...action.payload } : p
        ),
      };

    case 'ADD_DELIVERY_PLAN':
      return {
        ...state,
        deliveryPlans: [
          ...state.deliveryPlans,
          {
            batches: [],
            operationLogs: [],
            ...normalizePlan(action.payload),
          },
        ],
      };

    case 'UPDATE_DELIVERY_PLAN':
      return {
        ...state,
        deliveryPlans: state.deliveryPlans.map((p) =>
          p.id === action.payload.id ? normalizePlan({ ...p, ...action.payload }) : p
        ),
      };

    case 'UPDATE_DELIVERY_BATCH':
      return {
        ...state,
        deliveryPlans: state.deliveryPlans.map((plan) => plan.id === action.payload.planId ? {
          ...plan,
          updatedAt: action.payload.batch.updatedAt || plan.updatedAt,
          batches: arrayOrEmpty(plan.batches).map((batch) => (
            batch.id === action.payload.batch.id ? normalizeBatch(action.payload.batch) : batch
          )),
        } : plan),
      };

    case 'ADD_DELIVERY_EXCEPTION':
      return {
        ...state,
        deliveryExceptions: [...state.deliveryExceptions, action.payload],
      };

    case 'UPDATE_DELIVERY_EXCEPTION':
      return {
        ...state,
        deliveryExceptions: state.deliveryExceptions.map((item) =>
          item.id === action.payload.id ? { ...item, ...action.payload } : item
        ),
      };

    case 'ADD_LOCATION':
      return { ...state, locations: [...state.locations, action.payload] };

    case 'UPDATE_LOCATION':
      return {
        ...state,
        locations: state.locations.map((l) =>
          l.id === action.payload.id ? { ...l, ...action.payload } : l
        ),
      };

    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, baseDispatch] = useReducer(appReducer, initialState);
  const { currentUser, isAuthenticated } = useRole();
  const location = useLocation();
  const productionLoaded = useRef('');
  const projectCenterLoaded = useRef('');
  const erpLinksLoaded = useRef(false);
  const productionRequestVersion = useRef(0);
  const projectRequestVersion = useRef(0);
  const dispatch = useCallback((action) => {
    if (action.type === 'UPDATE_DEVICE_CONFIRMED') {
      return updateProductionDevice(action.payload.id, action.payload)
        .then((device) => {
          baseDispatch({ type: 'UPDATE_DEVICE', payload: device });
          return device;
        })
        .catch((error) => {
          baseDispatch({ type: 'SET_PRODUCTION_ERROR', payload: error.message });
          throw error;
        });
    }
    if (action.type === 'ADD_DEVICE') {
      return createProductionDevice(action.payload)
        .then((device) => {
          baseDispatch({ type: 'ADD_DEVICE', payload: device });
          return device;
        })
        .catch((error) => {
          baseDispatch({ type: 'SET_PRODUCTION_ERROR', payload: error.message });
          throw error;
        });
    }
    if (action.type === 'UPDATE_DEVICE') {
      return updateProductionDevice(action.payload.id, action.payload)
        .then((device) => {
          baseDispatch({ type: 'UPDATE_DEVICE', payload: device });
          return device;
        })
        .catch((error) => {
          baseDispatch({ type: 'SET_PRODUCTION_ERROR', payload: error.message });
          throw error;
        });
    }
    if (action.type === 'DELETE_DEVICE') {
      return deleteProductionDevice(action.payload)
        .then(() => baseDispatch({ type: 'DELETE_DEVICE', payload: action.payload }))
        .catch((error) => {
          baseDispatch({ type: 'SET_PRODUCTION_ERROR', payload: error.message });
          throw error;
        });
    }
    const projectCenterWrites = {
      ADD_PROJECT: () => createProject(action.payload),
      UPDATE_PROJECT: () => updateProject(action.payload.id, action.payload),
      ADD_LOCATION: () => createLocation(action.payload),
      UPDATE_LOCATION: () => updateLocation(action.payload.id, action.payload),
      ADD_DELIVERY_PLAN: () => createDeliveryPlan(action.payload),
      UPDATE_DELIVERY_PLAN: () => updateDeliveryPlan(action.payload.id, action.payload),
      UPDATE_DELIVERY_BATCH: () => updateDeliveryBatch(
        action.payload.planId,
        action.payload.batchId,
        action.payload.payload,
      ).then((batch) => ({ planId: action.payload.planId, batch })),
      ADD_DELIVERY_EXCEPTION: () => createDeliveryException(action.payload),
      UPDATE_DELIVERY_EXCEPTION: () => updateDeliveryException(action.payload.id, action.payload),
    };
    if (projectCenterWrites[action.type]) {
      return projectCenterWrites[action.type]()
        .then((payload) => {
          baseDispatch({ type: action.type, payload });
          return payload;
        })
        .catch((error) => {
          baseDispatch({ type: 'SET_PROJECT_CENTER_ERROR', payload: error.message });
          return null;
        });
    }
    if (action.type === 'ADD_OPERATION_LOG') {
      return createOperationLog(action.payload).then((log) => {
        baseDispatch({ type: 'ADD_OPERATION_LOG', payload: log });
        return log;
      }).catch((error) => {
        baseDispatch({ type: 'SET_PROJECT_CENTER_ERROR', payload: `操作日志保存失败：${error.message}` });
        return null;
      });
    }
    baseDispatch(action);
  }, []);
  useEffect(() => {
    const deviceMatch = location.pathname.match(/^\/devices\/([^/]+)$/);
    const productionDevice = location.pathname === '/production'
      ? new URLSearchParams(location.search).get('device') : null;
    const requestedDevice = deviceMatch?.[1] || productionDevice;
    if (!isAuthenticated || !requestedDevice) {
      productionRequestVersion.current += 1;
      productionLoaded.current = '';
      return;
    }
    const loadKey = `device:${requestedDevice}`;
    if (productionLoaded.current === loadKey) return;
    productionLoaded.current = loadKey;
    const requestVersion = ++productionRequestVersion.current;
    baseDispatch({ type: 'SET_PRODUCTION_LOADING', payload: true });
    const decodedDevice = decodeURIComponent(requestedDevice);
    const request = Promise.all([
      productionDevice ? getProductionDeviceById(decodedDevice) : getDeviceById(decodedDevice),
      productionDevice ? getProductionDeviceTypes() : getDeviceTypes(),
      getOperationLogs({ query: decodedDevice }),
    ]).then(([device, deviceTypes, operationLogs]) => ({ devices: [device], deviceTypes, operationLogs }));
    request
      .then((payload) => {
        if (requestVersion === productionRequestVersion.current) {
          baseDispatch({ type: 'SET_PRODUCTION_DATA', payload });
        }
      })
      .catch((error) => {
        if (requestVersion !== productionRequestVersion.current) return;
        productionLoaded.current = '';
        baseDispatch({ type: 'SET_PRODUCTION_ERROR', payload: error.message });
      });
  }, [isAuthenticated, location.pathname, location.search]);
  useEffect(() => {
    const deviceTab = new URLSearchParams(location.search).get('tab') || 'overview';
    const deviceNeedsProject = /^\/devices\/[^/]+$/.test(location.pathname)
      && ['project', 'logs'].includes(deviceTab);
    const projectMatch = location.pathname.match(/^\/projects\/([^/]+)$/);
    const deliveryMatch = location.pathname.match(/^\/delivery-plans\/([^/]+)(?:\/batches\/([^/]+))?$/);
    const device = deviceNeedsProject
      ? state.devices.find((item) => item.id === decodeURIComponent(location.pathname.split('/')[2]) || item.sn === decodeURIComponent(location.pathname.split('/')[2]))
      : null;
    const requestedProjectId = projectMatch?.[1] || device?.projectId || '';
    const requestedProjectTab = projectMatch
      ? (new URLSearchParams(location.search).get('tab') || 'overview')
      : 'delivery';
    const key = projectMatch ? `project:${requestedProjectId}:${requestedProjectTab}`
      : deliveryMatch ? `delivery:${deliveryMatch[1]}:${deliveryMatch[2] || ''}`
        : device?.projectId ? `project:${requestedProjectId}:${requestedProjectTab}` : '';
    if (!isAuthenticated || !key) {
      projectRequestVersion.current += 1;
      projectCenterLoaded.current = '';
      return;
    }
    if (projectCenterLoaded.current === key) return;
    projectCenterLoaded.current = key;
    const requestVersion = ++projectRequestVersion.current;
    baseDispatch({ type: 'SET_PROJECT_CENTER_LOADING', payload: true });
    const request = key.startsWith('delivery:')
      ? loadDeliveryResources(
        decodeURIComponent(deliveryMatch[1]),
        deliveryMatch[2] ? decodeURIComponent(deliveryMatch[2]) : '',
      )
      : loadProjectResources(decodeURIComponent(requestedProjectId), requestedProjectTab);
    request
      .then((payload) => {
        if (requestVersion === projectRequestVersion.current) {
          baseDispatch({ type: 'SET_PROJECT_CENTER_DATA', payload });
        }
      })
      .catch((error) => {
        if (requestVersion !== projectRequestVersion.current) return;
        projectCenterLoaded.current = '';
        baseDispatch({ type: 'SET_PROJECT_CENTER_ERROR', payload: error.message });
      });
  }, [isAuthenticated, location.pathname, location.search, state.devices]);
  useEffect(() => {
    if (!isAuthenticated || location.pathname !== '/erp-center') {
      erpLinksLoaded.current = false;
      return;
    }
    if (erpLinksLoaded.current) return;
    erpLinksLoaded.current = true;
    getDeviceErpLinks()
      .then((payload) => baseDispatch({ type: 'SET_DEVICE_REFERENCES', payload }))
      .catch(() => { erpLinksLoaded.current = false; });
  }, [isAuthenticated, location.pathname]);
  useEffect(() => {
    dispatch({ type: 'SET_AUTH_USER', payload: currentUser });
  }, [currentUser, dispatch]);
  useEffect(() => {
    if (!isAuthenticated) return;
    getBusinessDictionaries().then((payload) => {
      configureProductionSteps(payload?.productionNodes);
      baseDispatch({ type: 'SET_DICTIONARIES', payload });
    }).catch((error) => {
      baseDispatch({ type: 'SET_PROJECT_CENTER_ERROR', payload: `业务字典加载失败：${error.message}` });
    });
  }, [isAuthenticated]);
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
