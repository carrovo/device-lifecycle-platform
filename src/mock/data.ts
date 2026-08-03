// Snapshot rows are intentionally schema-driven and transformed dynamically.
import snapshot from './dbSnapshot.json';

export const MOCK_STORAGE_KEY = `device-lifecycle-db-snapshot-v${snapshot.snapshotVersion}-transform-v2`;
export const MOCK_EXPORTED_AT = snapshot.exportedAt;

type Row = Record<string, any>;

const camelKey = (key: string) => key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
const camelRow = (row: Row): Row => Object.fromEntries(Object.entries(row).map(([key, value]) => [camelKey(key), value]));
const table = (name: keyof typeof snapshot.tables): Row[] => (snapshot.tables[name] as Row[]).map(camelRow);
const bool = (value: unknown) => value === true
  || value === 1
  || value === '1'
  // MySQL JSON_OBJECT serializes BIT(1) values through the CLI as binary data.
  || (typeof value === 'string' && /^base64:type16:AQ==$/.test(value));
const parseList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String);
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return String(value).split(',').map((item) => item.trim()).filter(Boolean);
  }
};

const erpTypeKey = (type = '') => {
  if (type.includes('销售')) return 'salesOutbound';
  if (type.includes('调拨')) return 'transferOrder';
  if (type.includes('产品入库')) return 'productInbound';
  return '';
};

export const deviceTypes = table('production_device_type');

export const dictionaries = {
  projectTypes: table('sys_project_type')
    .filter((item) => bool(item.enabled))
    .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder)),
  productionNodes: table('sys_production_node')
    .filter((item) => bool(item.enabled))
    .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder))
    .map((item) => ({ key: item.nodeKey, label: item.nodeName, kind: item.nodeKind })),
};

export const roles = table('sys_role')
  .filter((item) => bool(item.enabled))
  .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder))
  .map((item) => ({
    role: item.roleName,
    displayName: item.displayName,
    description: item.description,
    modules: item.moduleScope,
    allowedPaths: parseList(item.routePaths),
  }));

export function createInitialState(): any {
  const historyRevisions = table('production_history_revision');
  const historyCorrections = table('production_history_correction');
  const productionHistory: Row[] = table('production_history').map((item): Row => ({
    ...item,
    time: item.occurredAt,
    revisions: historyRevisions.filter((revision) => revision.historyId === item.id),
    corrections: historyCorrections.filter((correction) => correction.historyId === item.id),
  }));
  const inboundLinks = table('production_device_erp_inbound_link');
  const deviceFeishuLinks = table('production_device_feishu_link');
  const devices: Row[] = table('production_device').map((item): Row => ({
    ...item,
    productionComplete: bool(item.productionComplete),
    productionHistory: productionHistory
      .filter((history) => history.deviceId === item.id)
      .sort((a, b) => Number(a.sequenceNo) - Number(b.sequenceNo)),
    erpInboundLinks: inboundLinks.filter((link) => link.deviceId === item.id).map((link) => ({
      ...link,
      recordId: link.erpRecordId,
      batchNo: link.batchNo,
      serialNo: link.serialNo,
      inboundTime: link.inboundTime,
      inboundNo: link.inboundNo,
      productCode: link.productCode,
      productName: link.productName,
    })),
    otherFeishuTables: deviceFeishuLinks
      .filter((link) => link.deviceId === item.id)
      .sort((a, b) => Number(a.sequenceNo) - Number(b.sequenceNo))
      .map((link) => ({ id: link.id, name: link.linkName, url: link.linkUrl, note: link.note })),
    deliveryPlanIds: [],
  }));

  const resultRevisions = table('project_center_delivery_result_revision');
  const relations: Row[] = table('project_center_delivery_device_relation').map((item): Row => ({
    ...item,
    resultHistory: resultRevisions
      .filter((revision) => revision.relationId === item.id)
      .sort((a, b) => Number(a.sequenceNo) - Number(b.sequenceNo)),
  }));
  const erpReferences: Row[] = table('project_center_delivery_erp_reference').map((item): Row => ({
    ...item,
    type: item.referenceType,
    typeKey: erpTypeKey(item.referenceType),
    no: item.referenceNo,
  }));
  const deliveryFeishuLinks = table('project_center_delivery_feishu_link');
  const siteRecordDevices = table('project_center_delivery_site_record_device');
  const siteRecords: Row[] = table('project_center_delivery_site_record').map((item): Row => ({
    ...item,
    hasException: bool(item.hasException),
    time: item.recordTime,
    deviceIds: siteRecordDevices.filter((link) => link.recordId === item.id).map((link) => link.deviceId),
  }));
  const batches: Row[] = table('project_center_delivery_batch').map((item): Row => ({
    ...item,
    sequence: item.sequenceNo,
    deviceRelations: relations.filter((relation) => relation.batchId === item.id),
    erpReferences: erpReferences.filter((reference) => reference.batchId === item.id),
    feishuLinks: deliveryFeishuLinks
      .filter((link) => link.batchId === item.id)
      .sort((a, b) => Number(a.sequenceNo) - Number(b.sequenceNo))
      .map((link) => ({ id: link.id, name: link.linkName, url: link.linkUrl, note: link.note })),
    siteRecords: siteRecords.filter((record) => record.batchId === item.id),
  }));
  const deliveryPlans: Row[] = table('project_center_delivery_plan').map((item): Row => ({
    ...item,
    batches: batches.filter((batch) => batch.deliveryPlanId === item.id),
  }));
  const exceptionDevices = table('project_center_delivery_exception_device');
  const deliveryExceptions: Row[] = table('project_center_delivery_exception').map((item): Row => ({
    ...item,
    affectedDeviceIds: exceptionDevices.filter((link) => link.exceptionId === item.id).map((link) => link.deviceId),
  }));
  const users = table('sys_user');
  const operationLogs: Row[] = table('sys_operation_log').map((item): Row => ({
    ...item,
    timestamp: item.occurredAt,
    operator: item.operatorName,
  }));

  return {
    projects: table('project_center_project'),
    locations: table('project_center_location').map((item) => ({ ...item, disabled: bool(item.disabled) })),
    devices,
    deliveryPlans,
    deliveryExceptions,
    users,
    operationLogs,
  };
}

export function createErpFixtures() {
  const state = createInitialState();
  const productInbound = new Map<string, Row>();
  state.devices.forEach((device) => {
    device.erpInboundLinks.forEach((link) => {
      if (!link.inboundNo) return;
      const current = productInbound.get(link.inboundNo) || {
        id: link.inboundNo,
        code: link.inboundNo,
        vouchdate: String(link.inboundTime || '').slice(0, 10),
        warehouse_name: link.warehouse,
        storeProRecords: [],
      };
      current.storeProRecords.push({
        id: link.recordId,
        product_cCode: link.productCode,
        product_cName: link.productName,
        batchno: link.batchNo,
        qty: link.quantity,
        stockUnit_name: '',
        serialNo: link.serialNo,
      });
      productInbound.set(link.inboundNo, current);
    });
  });

  const deliveryDocuments: Record<string, Map<string, Row>> = {
    'sales-outs': new Map(),
    'transfer-orders': new Map(),
  };
  state.deliveryPlans.forEach((plan) => plan.batches.forEach((batch) => {
    batch.erpReferences.forEach((reference) => {
      const bucket = reference.typeKey === 'salesOutbound' ? deliveryDocuments['sales-outs']
        : reference.typeKey === 'transferOrder' ? deliveryDocuments['transfer-orders'] : null;
      if (!bucket || !reference.no) return;
      const relations = batch.deviceRelations.filter((relation) => !relation.erpSourceNo || relation.erpSourceNo === reference.no);
      if (reference.typeKey === 'salesOutbound') {
        bucket.set(reference.no, {
          id: reference.businessId || reference.no,
          code: reference.no,
          vouchdate: reference.documentDate,
          status: reference.sourceStatus,
          details: relations.map((relation) => ({ id: relation.erpDetailId || relation.id, batchno: relation.erpBatchNo, qty: 1 })),
        });
      } else {
        bucket.set(reference.no, {
          id: reference.businessId || reference.no,
          code: reference.no,
          vouchdate: reference.documentDate,
          status: reference.sourceStatus,
          transferApplys: relations.map((relation) => ({ id: relation.erpDetailId || relation.id, batchno: relation.erpBatchNo, qty: 1 })),
        });
      }
    });
  }));

  return {
    'arrival-orders': [],
    'inspect-orders': [],
    'purchase-in-records': [],
    'production-orders': [],
    'material-outs': [],
    'product-in-records': [...productInbound.values()],
    'sales-outs': [...deliveryDocuments['sales-outs'].values()],
    'transfer-orders': [...deliveryDocuments['transfer-orders'].values()],
  };
}
