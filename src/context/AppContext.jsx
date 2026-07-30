/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useReducer } from 'react';
import {
  materials as initMaterials,
  materialBatches as initMaterialBatches,
  devices as initDevices,
  testRecords as initTestRecords,
  deviceTypes as initDeviceTypes,
  moduleTypes as initModuleTypes,
  productionPlans as initProductionPlans,
  operationLogs as initOperationLogs,
  projects as initProjects,
  deviceAllocations as initDeviceAllocations,
  deliveryRecords as initDeliveryRecords,
  alerts as initAlerts,
  workOrders as initWorkOrders,
  retirements as initRetirements,
  moduleReplacements as initModuleReplacements,
  labelCategories as initLabelCategories,
  productionWorkOrders as initProductionWorkOrders,
  deliveryWorkOrders as initDeliveryWorkOrders,
  deliveryPlans as initDeliveryPlans,
  workflowProductionPlans as initWorkflowProductionPlans,
  locations as initLocations,
  qualityIssues as initQualityIssues,
  moduleInstances as initModuleInstances,
  deliveryExceptions as initDeliveryExceptions,
  FEISHU_USERS,
  REVIEW_DATA_APPEND_IDS,
} from '../data/mockData';
import { normalizePrdState } from '../data/prdV12';
import { normalizeDeliveryV2 } from '../data/deliveryV2';

const AppContext = createContext(null);
const FEISHU_STORAGE_KEY = 'device-lifecycle-feishu-records-v1';
const DELIVERY_STORAGE_KEY = 'device-lifecycle-delivery-v5';
const CORE_STORAGE_KEY = 'device-lifecycle-core-v1';
const REVIEW_APPEND_STORAGE_KEY = `device-lifecycle-${REVIEW_DATA_APPEND_IDS.version}`;

function readFeishuRecords() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(FEISHU_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function readStoredDelivery() {
  if (typeof window === 'undefined') return null;
  try {
    const stored = JSON.parse(window.localStorage.getItem(DELIVERY_STORAGE_KEY) || 'null');
    return Array.isArray(stored?.plans) ? stored : null;
  } catch {
    return null;
  }
}

function readStoredCore() {
  if (typeof window === 'undefined') return null;
  try {
    const stored = JSON.parse(window.localStorage.getItem(CORE_STORAGE_KEY) || 'null');
    return stored && Array.isArray(stored.devices) && Array.isArray(stored.projects) && Array.isArray(stored.locations)
      ? stored
      : null;
  } catch {
    return null;
  }
}

function hasAppliedReviewAppend() {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(REVIEW_APPEND_STORAGE_KEY) === 'applied';
  } catch {
    return true;
  }
}

function appendMissingById(current, defaults, ids) {
  const existingIds = new Set(current.map((item) => item.id));
  const allowedIds = new Set(ids);
  return [
    ...current,
    ...defaults.filter((item) => allowedIds.has(item.id) && !existingIds.has(item.id)),
  ];
}

function applyDeliveryMemberships(devices, plans) {
  const memberships = new Map();
  plans.forEach((plan) => {
    (plan.batches || []).forEach((batch) => {
      (batch.deviceRelations || []).forEach((relation) => {
        const current = memberships.get(relation.deviceId) || [];
        memberships.set(relation.deviceId, [...current, { planId: plan.id, batchId: batch.id }]);
      });
    });
  });
  return devices.map((device) => {
    const linked = memberships.get(device.id) || [];
    return {
      ...device,
      deliveryPlanId: linked[0]?.planId || null,
      deliveryPlanIds: [...new Set(linked.map((item) => item.planId))],
      deliveryBatchId: linked[0]?.batchId || null,
    };
  });
}

const storedCore = readStoredCore();
const storedDelivery = readStoredDelivery();
const shouldAppendReviewData = !!(storedCore || storedDelivery) && !hasAppliedReviewAppend();
const sourceDevices = storedCore
  ? (shouldAppendReviewData ? appendMissingById(storedCore.devices, initDevices, REVIEW_DATA_APPEND_IDS.deviceIds) : storedCore.devices)
  : initDevices;
const sourceProjects = storedCore
  ? (shouldAppendReviewData ? appendMissingById(storedCore.projects, initProjects, [REVIEW_DATA_APPEND_IDS.projectId]) : storedCore.projects)
  : initProjects;
const sourceLocations = storedCore
  ? (shouldAppendReviewData ? appendMissingById(storedCore.locations, initLocations, [REVIEW_DATA_APPEND_IDS.locationId]) : storedCore.locations)
  : initLocations;
const sourceOperationLogs = storedCore?.operationLogs || initOperationLogs;
const normalizedPrd = normalizePrdState({
  devices: sourceDevices,
  testRecords: initTestRecords,
  deliveryPlans: initDeliveryPlans,
  locations: sourceLocations,
  deliveryExceptions: initDeliveryExceptions,
});
const sourceDeliveryPlans = storedDelivery
  ? (shouldAppendReviewData ? appendMissingById(storedDelivery.plans, initDeliveryPlans, [REVIEW_DATA_APPEND_IDS.deliveryPlanId]) : storedDelivery.plans)
  : initDeliveryPlans;
const normalizedDelivery = normalizeDeliveryV2({
  plans: sourceDeliveryPlans,
  projects: sourceProjects,
  locations: sourceLocations,
  devices: normalizedPrd.devices,
  exceptions: storedDelivery?.exceptions || initDeliveryExceptions,
});
const initialDeliveryPlans = normalizedDelivery.deliveryPlans;
const initialDeliveryExceptions = storedDelivery?.exceptions
  ? [
      ...storedDelivery.exceptions,
      ...normalizedDelivery.deliveryExceptions.filter((item) =>
        !storedDelivery.exceptions.some((stored) => stored.id === item.id)
      ),
    ]
  : normalizedDelivery.deliveryExceptions;
const devicesWithDelivery = applyDeliveryMemberships(normalizedDelivery.devices, initialDeliveryPlans);
const storedFeishuRecords = readFeishuRecords();
const devicesWithStoredFeishu = devicesWithDelivery.map((device) => {
  const stored = storedFeishuRecords[device.id];
  if (!stored) return device;
  return {
    ...device,
    electronicAcceptanceUrl: typeof stored.electronicAcceptanceUrl === 'string'
      ? stored.electronicAcceptanceUrl
      : device.electronicAcceptanceUrl,
    otherFeishuTables: Array.isArray(stored.otherFeishuTables)
      ? stored.otherFeishuTables.filter((item) => item?.name && !/^\d+$/.test(item.name.trim()) && item?.url)
      : device.otherFeishuTables,
  };
});

const initialState = {
  materials: initMaterials,
  materialBatches: initMaterialBatches,
  devices: devicesWithStoredFeishu,
  testRecords: initTestRecords,
  deviceTypes: initDeviceTypes,
  moduleTypes: initModuleTypes,
  productionPlans: initProductionPlans,
  operationLogs: sourceOperationLogs,
  projects: sourceProjects,
  deviceAllocations: initDeviceAllocations,
  deliveryRecords: initDeliveryRecords,
  alerts: initAlerts,
  workOrders: initWorkOrders,
  retirements: initRetirements,
  moduleReplacements: initModuleReplacements,
  labelCategories: initLabelCategories,
  productionWorkOrders: initProductionWorkOrders,
  deliveryWorkOrders: initDeliveryWorkOrders,
  deliveryPlans: initialDeliveryPlans,
  workflowProductionPlans: initWorkflowProductionPlans,
  locations: sourceLocations,
  qualityIssues: initQualityIssues,
  moduleInstances: initModuleInstances,
  deliveryExceptions: initialDeliveryExceptions,
  users: FEISHU_USERS.map((user) => ({ status: '启用', ...user, role: user.id === 'u1' ? '管理员' : user.role })),
  currentUser: '张三',
  currentUserId: 'u1',
};

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_CURRENT_USER': {
      const user = state.users.find((u) => u.id === action.payload);
      return { ...state, currentUserId: action.payload, currentUser: user?.name || state.currentUser };
    }

    case 'UPDATE_USER':
      return {
        ...state,
        users: state.users.map((user) =>
          user.id === action.payload.id ? { ...user, ...action.payload } : user
        ),
      };

    case 'ADD_MATERIAL':
      return { ...state, materials: [...state.materials, action.payload] };

    case 'UPDATE_MATERIAL':
      return {
        ...state,
        materials: state.materials.map((m) =>
          m.id === action.payload.id ? { ...m, ...action.payload } : m
        ),
      };

    case 'ADD_MATERIAL_BATCH':
      return { ...state, materialBatches: [...state.materialBatches, action.payload] };

    case 'UPDATE_MATERIAL_BATCH':
      return {
        ...state,
        materialBatches: state.materialBatches.map((b) =>
          b.id === action.payload.id ? { ...b, ...action.payload } : b
        ),
      };

    case 'ADD_DEVICE':
      return { ...state, devices: [...state.devices, action.payload] };

    case 'UPDATE_DEVICE':
      return {
        ...state,
        devices: state.devices.map((d) =>
          d.id === action.payload.id ? { ...d, ...action.payload } : d
        ),
      };

    case 'DELETE_DEVICE':
      return {
        ...state,
        devices: state.devices.filter((d) => d.id !== action.payload),
      };

    case 'ADD_TEST_RECORD':
      return { ...state, testRecords: [...state.testRecords, action.payload] };

    case 'UPDATE_TEST_RECORD':
      return {
        ...state,
        testRecords: state.testRecords.map((t) =>
          t.id === action.payload.id ? { ...t, ...action.payload } : t
        ),
      };

    case 'ADD_OPERATION_LOG':
      return { ...state, operationLogs: [...state.operationLogs, action.payload] };

    case 'ADD_PRODUCTION_PLAN':
      if (action.payload.currentNode || action.payload.targetCount) {
        return { ...state, workflowProductionPlans: [...state.workflowProductionPlans, action.payload] };
      }
      return { ...state, productionPlans: [...state.productionPlans, action.payload] };

    case 'UPDATE_PRODUCTION_PLAN':
      return {
        ...state,
        productionPlans: state.productionPlans.map((p) =>
          p.id === action.payload.id ? { ...p, ...action.payload } : p
        ),
        workflowProductionPlans: state.workflowProductionPlans.map((p) =>
          p.id === action.payload.id ? { ...p, ...action.payload } : p
        ),
      };

    case 'DELETE_PRODUCTION_PLAN':
      return {
        ...state,
        productionPlans: state.productionPlans.filter((p) => p.id !== action.payload),
      };

    case 'ADD_DEVICE_TYPE':
      return { ...state, deviceTypes: [...state.deviceTypes, action.payload] };

    case 'ADD_MODULE_TYPE':
      return { ...state, moduleTypes: [...state.moduleTypes, action.payload] };

    // Part2 & Part3 cases
    case 'ADD_PROJECT':
      return { ...state, projects: [...state.projects, action.payload] };

    case 'UPDATE_PROJECT':
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.payload.id ? { ...p, ...action.payload } : p
        ),
      };

    case 'ADD_DEVICE_ALLOCATION':
      return { ...state, deviceAllocations: [...state.deviceAllocations, action.payload] };

    case 'TRANSFER_DEVICE_ALLOCATION':
      return { ...state, deviceAllocations: [...state.deviceAllocations, action.payload] };

    case 'ADD_DELIVERY_RECORD':
      return { ...state, deliveryRecords: [...state.deliveryRecords, action.payload] };

    case 'ADD_ALERT':
      return { ...state, alerts: [...state.alerts, action.payload] };

    case 'UPDATE_ALERT':
      return {
        ...state,
        alerts: state.alerts.map((a) =>
          a.id === action.payload.id ? { ...a, ...action.payload } : a
        ),
      };

    case 'ADD_WORK_ORDER':
      return { ...state, workOrders: [...state.workOrders, action.payload] };

    case 'UPDATE_WORK_ORDER':
      return {
        ...state,
        workOrders: state.workOrders.map((w) =>
          w.id === action.payload.id ? { ...w, ...action.payload } : w
        ),
      };

    case 'ADD_RETIREMENT':
      return { ...state, retirements: [...state.retirements, action.payload] };

    case 'ADD_MODULE_REPLACEMENT':
      return { ...state, moduleReplacements: [...state.moduleReplacements, action.payload] };

    case 'UPDATE_MODULE_TYPE':
      return {
        ...state,
        moduleTypes: state.moduleTypes.map((m) =>
          m.id === action.payload.id ? { ...m, ...action.payload } : m
        ),
      };

    case 'UPDATE_DEVICE_TYPE':
      return {
        ...state,
        deviceTypes: state.deviceTypes.map((d) =>
          d.id === action.payload.id ? { ...d, ...action.payload } : d
        ),
      };

    case 'ADD_PRODUCTION_WORK_ORDER':
      return { ...state, productionWorkOrders: [...state.productionWorkOrders, action.payload] };

    case 'UPDATE_PRODUCTION_WORK_ORDER':
      return {
        ...state,
        productionWorkOrders: state.productionWorkOrders.map((w) =>
          w.id === action.payload.id ? { ...w, ...action.payload } : w
        ),
      };

    case 'ADD_DELIVERY_WORK_ORDER':
      return { ...state, deliveryWorkOrders: [...state.deliveryWorkOrders, action.payload] };

    case 'UPDATE_DELIVERY_WORK_ORDER':
      return {
        ...state,
        deliveryWorkOrders: state.deliveryWorkOrders.map((w) =>
          w.id === action.payload.id ? { ...w, ...action.payload } : w
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
            ...action.payload,
          },
        ],
      };

    case 'UPDATE_DELIVERY_PLAN':
      return {
        ...state,
        deliveryPlans: state.deliveryPlans.map((p) =>
          p.id === action.payload.id ? { ...p, ...action.payload } : p
        ),
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

    case 'DELETE_DELIVERY_EXCEPTION':
      return {
        ...state,
        deliveryExceptions: state.deliveryExceptions.filter((item) => item.id !== action.payload),
      };

    case 'ADD_LABEL_CATEGORY':
      return { ...state, labelCategories: [...state.labelCategories, action.payload] };

    case 'UPDATE_LABEL_CATEGORY':
      return {
        ...state,
        labelCategories: state.labelCategories.map((c) =>
          c.id === action.payload.id ? { ...c, ...action.payload } : c
        ),
      };

    case 'DELETE_LABEL_CATEGORY':
      return { ...state, labelCategories: state.labelCategories.filter((c) => c.id !== action.payload) };

    case 'ADD_LOCATION':
      return { ...state, locations: [...state.locations, action.payload] };

    case 'UPDATE_LOCATION':
      return {
        ...state,
        locations: state.locations.map((l) =>
          l.id === action.payload.id ? { ...l, ...action.payload } : l
        ),
      };

    case 'DELETE_LOCATION':
      return { ...state, locations: state.locations.filter((l) => l.id !== action.payload) };

    case 'ADD_QUALITY_ISSUE':
      return { ...state, qualityIssues: [...state.qualityIssues, action.payload] };

    case 'UPDATE_QUALITY_ISSUE':
      return {
        ...state,
        qualityIssues: state.qualityIssues.map((q) =>
          q.id === action.payload.id ? { ...q, ...action.payload } : q
        ),
      };

    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  useEffect(() => {
    try {
      const records = Object.fromEntries(state.devices.map((device) => [device.id, {
        electronicAcceptanceUrl: device.electronicAcceptanceUrl || '',
        otherFeishuTables: device.otherFeishuTables || [],
      }]));
      window.localStorage.setItem(FEISHU_STORAGE_KEY, JSON.stringify(records));
    } catch {
      // Local persistence is best effort in the frontend prototype.
    }
  }, [state.devices]);

  useEffect(() => {
    try {
      window.localStorage.setItem(DELIVERY_STORAGE_KEY, JSON.stringify({
        plans: state.deliveryPlans,
        exceptions: state.deliveryExceptions,
      }));
    } catch {
      // Local persistence is best effort in the frontend prototype.
    }
  }, [state.deliveryPlans, state.deliveryExceptions]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CORE_STORAGE_KEY, JSON.stringify({
        devices: state.devices,
        projects: state.projects,
        locations: state.locations,
        operationLogs: state.operationLogs,
      }));
    } catch {
      // Local persistence is best effort in the frontend prototype.
    }
  }, [state.devices, state.projects, state.locations, state.operationLogs]);

  useEffect(() => {
    if (!shouldAppendReviewData) return;
    try {
      window.localStorage.setItem(REVIEW_APPEND_STORAGE_KEY, 'applied');
    } catch {
      // The ID-based append remains safe if the marker cannot be persisted.
    }
  }, []);

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
