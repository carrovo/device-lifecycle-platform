/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useReducer } from 'react';
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
} from '../data/mockData';

const AppContext = createContext(null);

const initialState = {
  materials: initMaterials,
  materialBatches: initMaterialBatches,
  devices: initDevices,
  testRecords: initTestRecords,
  deviceTypes: initDeviceTypes,
  moduleTypes: initModuleTypes,
  productionPlans: initProductionPlans,
  operationLogs: initOperationLogs,
  projects: initProjects,
  deviceAllocations: initDeviceAllocations,
  deliveryRecords: initDeliveryRecords,
  alerts: initAlerts,
  workOrders: initWorkOrders,
  retirements: initRetirements,
  moduleReplacements: initModuleReplacements,
  labelCategories: initLabelCategories,
  productionWorkOrders: initProductionWorkOrders,
  deliveryWorkOrders: initDeliveryWorkOrders,
  deliveryPlans: initDeliveryPlans,
  workflowProductionPlans: initWorkflowProductionPlans,
  locations: initLocations,
  qualityIssues: initQualityIssues,
  moduleInstances: initModuleInstances,
  deliveryExceptions: initDeliveryExceptions,
  currentUser: '张三',
  currentUserId: 'u1',
};

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_CURRENT_USER': {
      const user = FEISHU_USERS.find((u) => u.id === action.payload);
      return { ...state, currentUserId: action.payload, currentUser: user?.name || state.currentUser };
    }

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
            records: { binding: [], factoryInspection: [], siteInstall: [], customerAccept: [] },
            boundDeviceIds: [],
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
