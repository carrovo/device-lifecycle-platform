import { createInitialState, deviceTypes, dictionaries, MOCK_STORAGE_KEY, roles } from './data';

type MockState = ReturnType<typeof createInitialState>;

const wait = (ms = 90) => new Promise((resolve) => window.setTimeout(resolve, ms));
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const bodyOf = (options: RequestInit) => options.body ? JSON.parse(String(options.body)) : {};
const now = () => new Date().toLocaleString('zh-CN', { hour12: false }).replaceAll('/', '-');

function readState(): MockState {
  try {
    const stored = localStorage.getItem(MOCK_STORAGE_KEY);
    return stored ? JSON.parse(stored) : createInitialState();
  } catch {
    return createInitialState();
  }
}

function saveState(state: MockState) {
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(state));
}

function page(items: any[], params: URLSearchParams) {
  const current = Math.max(1, Number(params.get('page')) || 1);
  const size = Math.max(1, Number(params.get('size')) || 10);
  const start = (current - 1) * size;
  return { items: items.slice(start, start + size), page: current, size, total: items.length, totalPages: Math.max(1, Math.ceil(items.length / size)) };
}

const textMatch = (item: any, query: string, fields: string[]) => !query || fields.some((field) => String(item[field] ?? '').toLowerCase().includes(query.toLowerCase()));

function authUser(state: MockState) {
  return {
    ...state.users[0],
    allowedPaths: ['/home', '/dashboard', '/erp-center', '/production', '/projects', '/assets', '/after-sales', '/system'],
    projectScope: '全部项目', dataScope: '全部数据',
  };
}

function plansForProject(state: MockState, projectId: string) {
  return state.deliveryPlans.filter((plan) => plan.projectId === projectId);
}

function relationRows(state: MockState, plan: any, batchId = '') {
  return (plan?.batches || []).filter((batch) => !batchId || batch.id === batchId).flatMap((batch) =>
    (batch.deviceRelations || []).map((relation) => ({
      ...relation,
      batch: { id: batch.id, baseName: batch.baseName, supplement: batch.supplement, locationId: batch.locationId },
      device: state.devices.find((device) => device.id === relation.deviceId),
    })),
  );
}

function projectSummary(state: MockState, project: any) {
  return {
    ...project,
    pointCount: state.locations.filter((location) => location.projectId === project.id && !location.disabled).length,
    deviceCount: state.devices.filter((device) => device.projectId === project.id).length,
    deliveryPlanCount: plansForProject(state, project.id).length,
  };
}

function planSummary(state: MockState, plan: any) {
  const project = state.projects.find((item) => item.id === plan.projectId);
  return { ...plan, projectName: project?.name || '', batches: plan.batches || [] };
}

function filterByQuery(items: any[], params: URLSearchParams, fields: string[]) {
  const query = params.get('query') || '';
  return items.filter((item) => textMatch(item, query, fields));
}

function findBatch(state: MockState, planId: string, batchId: string) {
  return state.deliveryPlans.find((plan) => plan.id === planId)?.batches?.find((batch) => batch.id === batchId);
}

export async function mockApiRequest<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  await wait();
  const state = readState();
  const method = (options.method || 'GET').toUpperCase();
  const url = new URL(path, window.location.origin);
  const pathname = url.pathname;
  const params = url.searchParams;
  let match: RegExpMatchArray | null;

  if (pathname === '/api/auth/login' && method === 'POST') {
    const body = bodyOf(options);
    if (!String(body.username || '').trim() || !String(body.password || '').trim()) throw new Error('请输入账号和密码');
    return copy({ token: 'mock-vercel-demo-token', user: authUser(state) }) as T;
  }
  if (pathname === '/api/auth/me') return copy(authUser(state)) as T;
  if (pathname === '/api/auth/feishu/authorize') return { authorizeUrl: `${window.location.origin}/login/feishu/callback?ticket=mock-ticket` } as T;
  if (pathname === '/api/auth/feishu/exchange') return copy({ token: 'mock-feishu-token', user: authUser(state) }) as T;
  if (pathname === '/api/dictionaries') return copy(dictionaries) as T;

  if (pathname === '/api/devices/types' || pathname === '/api/production/devices/types') return copy(deviceTypes) as T;
  if (pathname === '/api/devices/stats') {
    const total = state.devices.length;
    const completed = state.devices.filter((item) => item.productionComplete).length;
    const inbound = state.devices.filter((item) => item.erpInboundNo).length;
    return { total, inProcess: total - completed, completed, inbound, pendingInbound: state.devices.filter((item) => item.productionComplete && !item.erpInboundNo).length } as T;
  }
  if (pathname === '/api/devices/erp-links') return copy(state.devices) as T;
  if ((pathname === '/api/devices' || pathname === '/api/production/devices') && method === 'GET') {
    let items = filterByQuery(state.devices, params, ['sn', 'robotNo', 'status']);
    const status = params.get('status');
    const model = params.get('model');
    const projectId = params.get('projectId');
    const inbound = params.get('inbound');
    const entered = params.get('entered');
    const repair = params.get('repair');
    if (status) items = items.filter((item) => item.productionStatus === status || item.currentProductionNode === status || item.status === status);
    if (model) items = items.filter((item) => item.deviceTypeId === model);
    if (projectId) items = items.filter((item) => item.projectId === projectId);
    if (inbound) items = items.filter((item) => inbound === 'yes' ? !!item.erpInboundNo : !item.erpInboundNo);
    if (entered) items = items.filter((item) => entered === 'yes' ? !!item.createdAt : !item.createdAt);
    if (repair) items = items.filter((item) => repair === 'yes' ? !!item.repairStatus : !item.repairStatus);
    items = [...items].sort((a, b) => params.get('sort') === 'asc' ? a.updatedAt.localeCompare(b.updatedAt) : b.updatedAt.localeCompare(a.updatedAt));
    return copy(page(items, params)) as T;
  }
  if ((match = pathname.match(/^\/api\/(?:production\/)?devices\/([^/]+)$/))) {
    const id = decodeURIComponent(match[1]);
    const index = state.devices.findIndex((item) => item.id === id || item.sn === id);
    if (method === 'GET') {
      if (index < 0) throw new Error('设备不存在');
      return copy(state.devices[index]) as T;
    }
    if (method === 'PATCH') {
      if (index < 0) throw new Error('设备不存在');
      state.devices[index] = { ...state.devices[index], ...bodyOf(options), id: state.devices[index].id, updatedAt: now() };
      saveState(state);
      return copy(state.devices[index]) as T;
    }
    if (method === 'DELETE') {
      if (index >= 0) state.devices.splice(index, 1);
      saveState(state);
      return null as T;
    }
  }
  if (pathname === '/api/production/devices' && method === 'POST') {
    const created = { ...bodyOf(options), updatedAt: now() };
    state.devices.push(created);
    saveState(state);
    return copy(created) as T;
  }

  if (pathname === '/api/project-center/project-options') return copy(state.projects.map((item) => ({ id: item.id, name: item.name }))) as T;
  if (pathname === '/api/project-center/manager-options') return copy([...new Set(state.projects.map((item) => item.manager).filter(Boolean))]) as T;
  if (pathname === '/api/project-center/delivery-owner-options') return copy([...new Set(state.deliveryPlans.map((item) => item.owner).filter(Boolean))]) as T;
  if (pathname === '/api/project-center/location-options') {
    const ids = params.getAll('ids');
    return copy(state.locations.filter((item) => !ids.length || ids.includes(item.id)).map((item) => ({ id: item.id, name: item.name, projectId: item.projectId }))) as T;
  }
  if (pathname === '/api/project-center/projects' && method === 'GET') {
    let items = filterByQuery(state.projects, params, ['id', 'name', 'client', 'manager']).map((item) => projectSummary(state, item));
    if (params.get('type')) items = items.filter((item) => item.projectType === params.get('type'));
    if (params.get('manager')) items = items.filter((item) => item.manager === params.get('manager'));
    if (params.get('updated')) items = items.filter((item) => String(item.updatedAt).startsWith(params.get('updated')));
    if (params.get('hasDevice')) items = items.filter((item) => params.get('hasDevice') === 'yes' ? item.deviceCount > 0 : item.deviceCount === 0);
    if (params.get('hasDelivery')) items = items.filter((item) => params.get('hasDelivery') === 'yes' ? item.deliveryPlanCount > 0 : item.deliveryPlanCount === 0);
    return copy(page(items, params)) as T;
  }
  if (pathname === '/api/project-center/projects' && method === 'POST') {
    const created = { ...bodyOf(options), updatedAt: now() };
    state.projects.push(created);
    saveState(state);
    return copy(created) as T;
  }
  if ((match = pathname.match(/^\/api\/project-center\/projects\/([^/]+)$/))) {
    const index = state.projects.findIndex((item) => item.id === decodeURIComponent(match[1]));
    if (index < 0) throw new Error('项目不存在');
    if (method === 'PATCH') {
      state.projects[index] = { ...state.projects[index], ...bodyOf(options), id: state.projects[index].id, updatedAt: now() };
      saveState(state);
    }
    return copy(projectSummary(state, state.projects[index])) as T;
  }
  if ((match = pathname.match(/^\/api\/project-center\/projects\/([^/]+)\/(locations|devices|delivery-plans|exceptions|operation-logs)$/))) {
    const projectId = decodeURIComponent(match[1]);
    const resource = match[2];
    let items: any[] = [];
    if (resource === 'locations') items = state.locations.filter((item) => item.projectId === projectId);
    if (resource === 'devices') items = state.devices.filter((item) => item.projectId === projectId);
    if (resource === 'delivery-plans') items = plansForProject(state, projectId).map((item) => planSummary(state, item));
    if (resource === 'exceptions') items = state.deliveryExceptions.filter((item) => item.projectId === projectId);
    if (resource === 'operation-logs') items = state.operationLogs.filter((item) => item.projectId === projectId);
    return copy(page(filterByQuery(items, params, ['id', 'name', 'sn', 'actionType', 'notes', 'description']), params)) as T;
  }
  if (pathname === '/api/project-center/locations' && method === 'POST') {
    const created = { ...bodyOf(options), updatedAt: now() };
    state.locations.push(created);
    saveState(state);
    return copy(created) as T;
  }
  if ((match = pathname.match(/^\/api\/project-center\/locations\/([^/]+)$/)) && method === 'PATCH') {
    const index = state.locations.findIndex((item) => item.id === decodeURIComponent(match[1]));
    if (index < 0) throw new Error('点位不存在');
    state.locations[index] = { ...state.locations[index], ...bodyOf(options), id: state.locations[index].id, updatedAt: now() };
    saveState(state);
    return copy(state.locations[index]) as T;
  }

  if (pathname === '/api/project-center/delivery-plans' && method === 'GET') {
    let items = filterByQuery(state.deliveryPlans, params, ['id', 'owner']).map((item) => planSummary(state, item));
    if (params.get('projectId')) items = items.filter((item) => item.projectId === params.get('projectId'));
    if (params.get('owner')) items = items.filter((item) => item.owner === params.get('owner'));
    if (params.get('targetDate')) items = items.filter((item) => item.targetDate === params.get('targetDate'));
    return copy(page(items, params)) as T;
  }
  if (pathname === '/api/project-center/delivery-plans' && method === 'POST') {
    const created = { batches: [], nextBatchSequence: 1, ...bodyOf(options), updatedAt: now() };
    state.deliveryPlans.push(created);
    saveState(state);
    return copy(created) as T;
  }
  if ((match = pathname.match(/^\/api\/project-center\/delivery-plans\/([^/]+)$/))) {
    const index = state.deliveryPlans.findIndex((item) => item.id === decodeURIComponent(match[1]));
    if (index < 0) throw new Error('交付执行不存在');
    if (method === 'PATCH') {
      state.deliveryPlans[index] = { ...state.deliveryPlans[index], ...bodyOf(options), id: state.deliveryPlans[index].id, updatedAt: now() };
      saveState(state);
    }
    return copy(planSummary(state, state.deliveryPlans[index])) as T;
  }
  if ((match = pathname.match(/^\/api\/project-center\/delivery-plans\/([^/]+)\/(batches|devices|exceptions|operation-logs)$/))) {
    const planId = decodeURIComponent(match[1]);
    const plan = state.deliveryPlans.find((item) => item.id === planId);
    if (!plan) throw new Error('交付执行不存在');
    const resource = match[2];
    let items: any[] = resource === 'batches' ? plan.batches || [] : resource === 'devices' ? relationRows(state, plan) : resource === 'exceptions' ? state.deliveryExceptions.filter((item) => item.deliveryPlanId === planId) : state.operationLogs.filter((item) => item.deliveryPlanId === planId);
    return copy(page(filterByQuery(items, params, ['id', 'baseName', 'sn', 'actionType', 'notes', 'description']), params)) as T;
  }
  if ((match = pathname.match(/^\/api\/project-center\/delivery-plans\/([^/]+)\/batches\/([^/]+)(?:\/(devices|site-records|result-revisions|exceptions|erp-references|feishu-links|operation-logs))?$/))) {
    const planId = decodeURIComponent(match[1]);
    const batchId = decodeURIComponent(match[2]);
    const batch = findBatch(state, planId, batchId);
    if (!batch) throw new Error('交付批次不存在');
    if (!match[3]) {
      if (method === 'PATCH') {
        Object.assign(batch, bodyOf(options), { id: batch.id, updatedAt: now() });
        saveState(state);
      }
      return copy(batch) as T;
    }
    const resource = match[3];
    let items: any[] = [];
    if (resource === 'devices') items = relationRows(state, state.deliveryPlans.find((item) => item.id === planId), batchId);
    if (resource === 'site-records') items = batch.siteRecords || [];
    if (resource === 'result-revisions') items = (batch.deviceRelations || []).flatMap((item) => item.resultHistory || []);
    if (resource === 'exceptions') items = state.deliveryExceptions.filter((item) => item.deliveryPlanId === planId && item.batchId === batchId);
    if (resource === 'erp-references') items = batch.erpReferences || [];
    if (resource === 'feishu-links') items = batch.feishuLinks || [];
    if (resource === 'operation-logs') items = state.operationLogs.filter((item) => item.deliveryPlanId === planId && item.batchId === batchId);
    return copy(page(filterByQuery(items, params, ['id', 'content', 'description', 'no', 'name', 'actionType', 'notes']), params)) as T;
  }
  if (pathname === '/api/project-center/delivery-exceptions' && method === 'POST') {
    const created = { affectedDeviceIds: [], ...bodyOf(options), recordTime: bodyOf(options).recordTime || now() };
    state.deliveryExceptions.push(created);
    saveState(state);
    return copy(created) as T;
  }
  if ((match = pathname.match(/^\/api\/project-center\/delivery-exceptions\/([^/]+)$/)) && method === 'PATCH') {
    const index = state.deliveryExceptions.findIndex((item) => item.id === decodeURIComponent(match[1]));
    if (index < 0) throw new Error('交付异常不存在');
    state.deliveryExceptions[index] = { ...state.deliveryExceptions[index], ...bodyOf(options), id: state.deliveryExceptions[index].id };
    saveState(state);
    return copy(state.deliveryExceptions[index]) as T;
  }

  if (pathname === '/api/system/users') {
    let items = filterByQuery(state.users, params, ['username', 'name', 'dept']);
    if (params.get('role')) items = items.filter((item) => item.role === params.get('role'));
    if (params.get('status')) items = items.filter((item) => item.status === params.get('status'));
    return copy(items) as T;
  }
  if ((match = pathname.match(/^\/api\/system\/users\/([^/]+)$/)) && method === 'PATCH') {
    const index = state.users.findIndex((item) => item.id === decodeURIComponent(match[1]));
    if (index < 0) throw new Error('用户不存在');
    state.users[index] = { ...state.users[index], ...bodyOf(options), id: state.users[index].id };
    saveState(state);
    return copy(state.users[index]) as T;
  }
  if (pathname === '/api/system/roles') return copy(roles.map((role) => ({ ...role, count: state.users.filter((user) => user.role === role.role).length }))) as T;
  if (pathname === '/api/system/operation-logs/filters') return copy({ operators: [...new Set(state.operationLogs.map((item) => item.operator))], modules: [...new Set(state.operationLogs.map((item) => item.module))] }) as T;
  if (pathname === '/api/system/operation-logs') {
    let items = filterByQuery(state.operationLogs, params, ['actionType', 'notes', 'objectId']);
    if (params.get('operator')) items = items.filter((item) => item.operator === params.get('operator'));
    if (params.get('module')) items = items.filter((item) => item.module === params.get('module'));
    if (params.get('date')) items = items.filter((item) => item.timestamp.startsWith(params.get('date')));
    return copy(items) as T;
  }
  if (pathname === '/api/operation-logs' && method === 'POST') {
    const created = { operator: authUser(state).name, timestamp: now(), ...bodyOf(options) };
    state.operationLogs.unshift(created);
    saveState(state);
    return copy(created) as T;
  }
  throw new Error(`Mock API 尚未实现：${method} ${pathname}`);
}

const erpFixtures: Record<string, any[]> = {
  'arrival-orders': [{ id: 'ERP-ARR-001', code: 'DH-202607-018', vouchdate: '2026-07-18', org_name: '深圳制造中心', busType_name: '采购到货', purchaseOrg_name: '采购部', vendor: 'V-001', vendor_name: '精密部件供应商', status: '已审核', arrivalOrders: [{ id: 'ARR-D-1', product_cCode: 'MAT-LIDAR', product_cName: '激光雷达组件', qty: 20, acceptqty: 20, refuseqty: 0, unit_name: '套', oriTaxUnitPrice: 3200, oriSum: 64000, oriTax: 7362 }] }],
  'inspect-orders': [{ id: 'ERP-QA-001', code: 'LJ-202607-022', inspectDate: '2026-07-20', pk_org_name: '质量中心', trantype_name: '来料检验', verifystate: 10, pk_material_code: 'MAT-LIDAR', pk_material_name: '激光雷达组件', inspectnum: 20, cunitid_name: '套', inspectResult: '合格', qms_qit_incominspectorder_resultList: [{ handleType_name: '接收', nnum: 20 }] }],
  'purchase-in-records': [{ id: 'ERP-PIN-001', code: 'CGRK-202607-031', vouchdate: '2026-07-22', org_name: '深圳制造中心', bustype_name: '采购入库', vendor: 'V-001', vendor_name: '精密部件供应商', warehouse_name: '原料仓', status: 1, purInRecords: [{ id: 'PIN-D-1', product_cCode: 'MAT-LIDAR', product_cName: '激光雷达组件', batchno: 'LIDAR-0722', qty: 20, stockUnit_name: '套', unit_name: '套', oriTaxUnitPrice: 3200, oriSum: 64000, oriTax: 7362 }] }],
  'production-orders': [{ id: 'ERP-PO-001', code: 'SC-202607-012', vouchdate: '2026-07-23', orgName: '深圳工厂', transTypeName: '标准生产', departmentName: '整机装配部', status: '已下达', orderProduct: [{ id: 'PO-D-1', lineNo: 1, productCode: 'ROBOT-ALPHA-2', productName: 'AlphaBot 2 智能服务机器人', quantity: 10, mainUnitName: '台', productUnitName: '台', startDate: '2026-07-24', finishDate: '2026-08-02' }] }],
  'material-outs': [{ id: 'ERP-MO-001', code: 'CLCK-202607-045', vouchdate: '2026-07-24', org_name: '深圳制造中心', bustype_name: '生产领料', department_name: '整机装配部', warehouse: 'WH-RAW', warehouse_name: '原料仓', operator_name: '李明', status: '已审核', materOuts: [{ id: 'MO-D-1', product_cCode: 'MAT-LIDAR', product_cName: '激光雷达组件', batchno: 'LIDAR-0722', qty: 10, stockUnit_name: '套' }] }],
  'product-in-records': [{ id: 'ERP-IN-001', code: 'CPRK-202607-001', vouchdate: '2026-07-28', org_name: '深圳制造中心', warehouse_name: '深圳成品仓', storeProRecords: [{ id: 'ERP-IN-DETAIL-1', product_cCode: 'ROBOT-ALPHA-2', product_cName: 'AlphaBot 2 智能服务机器人', batchno: 'AlphaBot2-0161', qty: 1, stockUnit_name: '台' }] }],
  'sales-outs': [{ id: 'ERP-SO-001', code: 'XSCK-202608-001', vouchdate: '2026-08-01', org: 'ORG-SZ', org_name: '深圳库存组织', bustype_name: '销售出库', cust: 'CUST-SH', cust_name: '上海未来科技馆', department_name: '项目交付部', status: '已审核', details: [{ id: 'SO-D-1', product_cCode: 'ROBOT-ALPHA-2', product_cName: 'AlphaBot 2 智能服务机器人', batchno: 'AlphaBot2-0161', qty: 3, stockUnit_name: '台', unitName: '台' }] }],
  'transfer-orders': [{ id: 'ERP-TR-008', code: 'DBSQ-202608-008', vouchdate: '2026-08-01', outwarehouse: 'WH-FIN', outwarehouse_name: '深圳成品仓', inwarehouse: 'WH-SZ-PARK', inwarehouse_name: '南山园区临时仓', transferApplys: [{ id: 'TR-D-1', product_cCode: 'ROBOT-ALPHA-2', product_cName: 'AlphaBot 2 智能服务机器人', batchno: 'AlphaBot2-0165', qty: 3, stockUnit_name: '台' }] }],
};

export async function mockErpResponse(path: string, options: RequestInit = {}) {
  await wait();
  const url = new URL(path, window.location.origin);
  const match = url.pathname.match(/^\/api\/yonyou\/([^/]+)\/(query|detail)$/);
  if (!match || !erpFixtures[match[1]]) throw new Error(`Mock ERP API 尚未实现：${url.pathname}`);
  const records = erpFixtures[match[1]];
  if (match[2] === 'detail') {
    const id = url.searchParams.get('id');
    const code = url.searchParams.get('code');
    return copy({ code: '200', message: 'success', data: records.find((item) => (!id || item.id === id) && (!code || item.code === code)) || records[0] });
  }
  const request = bodyOf(options);
  const query = String(request.code || '').toLowerCase();
  const filtered = records.filter((item) => !query || item.code.toLowerCase().includes(query));
  return copy({ code: '200', message: 'success', data: { recordList: filtered, recordCount: filtered.length, pageCount: 1 } });
}

export function resetMockData() {
  localStorage.removeItem(MOCK_STORAGE_KEY);
}
