import { mockErpResponse } from '../mock/server';
export const ERP_FILTER_NO_MATCH = '__ERP_FILTER_NO_MATCH__';

const ERP_API_CONFIG = {
  arrival: {
    listPath: '/api/yonyou/arrival-orders/query',
    detailPath: '/api/yonyou/arrival-orders/detail',
    defaults: { isSum: true },
    fields: {
      供货供应商: 'vendor_name',
      物料名称: 'product_cName',
      到货数量: 'qty',
    },
  },
  productInspection: {
    listPath: '/api/yonyou/inspect-orders/query',
    detailPath: '/api/yonyou/inspect-orders/detail',
    defaults: { billnum: 'qms_incominspectorder_list' },
    zeroBasedPage: true,
    detailParams: { billnum: 'qms_incominspectorder_card' },
    fields: {
      物料名称: 'pk_material_name',
      检验数量: 'inspectnum',
      检验结果: 'inspectResult',
      单据状态: 'verifystate',
    },
  },
  purchaseInbound: {
    listPath: '/api/yonyou/purchase-in-records/query',
    detailPath: '/api/yonyou/purchase-in-records/detail',
    defaults: { isSum: true },
    fields: {
      供应商: 'vendor_name',
      物料名称: 'product_cName',
      数量: 'qty',
    },
  },
  productionOrder: {
    listPath: '/api/yonyou/production-orders/query',
    detailPath: '/api/yonyou/production-orders/detail',
    defaults: {},
    fields: {
      工厂: 'orgName',
      物料名称: 'OrderProduct_productName',
      生产数量: 'OrderProduct_quantity',
    },
  },
  materialOutbound: {
    listPath: '/api/yonyou/material-outs/query',
    detailPath: '/api/yonyou/material-outs/detail',
    defaults: { isSum: true },
    fields: {
      仓库: 'warehouse_name',
      物料名称: 'product_cName',
      数量: 'qty',
    },
  },
  productInbound: {
    listPath: '/api/yonyou/product-in-records/query',
    detailPath: '/api/yonyou/product-in-records/detail',
    defaults: { isSum: true },
    fields: {
      序列号: 'StoreProRecordsSNs.0.sn',
      批次号: 'batchno',
      设备匹配: null,
    },
  },
  salesOutbound: {
    listPath: '/api/yonyou/sales-outs/query',
    detailPath: '/api/yonyou/sales-outs/detail',
    defaults: { isSum: true },
    fields: {
      客户: 'cust_name',
      库存组织: 'org_name',
      数量: 'qty',
    },
  },
  transferOrder: {
    listPath: '/api/yonyou/transfer-orders/query',
    detailPath: '/api/yonyou/transfer-orders/detail',
    defaults: { isSum: true },
    fields: {
      调出仓库: 'outwarehouse_name',
      调入仓库: 'inwarehouse_name',
      数量: 'qty',
    },
  },
};

const DETAIL_FIELDS = {
  arrival: ['单据日期', '到货单号', '收货组织', '交易类型', '采购组织', '供货供应商', '单据状态', '物料编码', '物料名称', '主计量单位', '到货数量', '实收数量', '拒收数量', '原单补货数量', '含税单价', '含税金额', '税额'],
  purchaseInbound: ['单据日期', '单据编号', '库存组织', '交易类型', '供应商', '仓库', '单据状态', '备注', '物料编码', '物料名称', '件数', '库存单位', '数量', '主计量', '无税单价', '无税金额', '含税单价', '含税金额', '税额'],
  productionOrder: ['单据日期', '生产订单号', '工厂', '交易类型', '生产部门', '订单状态', '行号', '物料编码', '物料名称', '生产数量', '主计量', '生产件数', '生产单位', '开工日期', '完工日期'],
  materialOutbound: ['单据日期', '单据编号', '库存组织', '交易类型', '部门', '业务员', '仓库', '库管员', '单据状态', '备注', '物料编码', '物料名称', '件数', '库存单位', '数量', '批次号'],
  productInspection: ['单据日期', '检验单号', '质检组织', '交易类型', '单据状态', '物料编码', '物料名称', '检验数量', '主计量', '检验件数', '检验单位', '检验结果', '处理方式', '处理数量'],
  productInbound: ['单据日期', '单据编号', '序列号/设备SN', '批次号/机器人编号'],
  salesOutbound: ['单据日期', '单据编号', '库存组织', '交易类型', '客户', '销售部门', '单据状态', '备注', '物料编码', '物料名称', 'SKU编码', 'SKU名称', '件数', '库存单位', '数量', '主计量'],
  transferOrder: ['单据日期', '单据编号', '调出仓库', '调入仓库', '数量'],
};

// 每个单据类型、每个展示字段最终只解析一个固定字段路径。
const DETAIL_FIELD_PATHS = Object.fromEntries(
  Object.keys(DETAIL_FIELDS).map((typeKey) => [typeKey, {}]),
);

// 展开行只展示经过白名单定义的业务明细字段，不透传完整响应。
const LIST_CHILD_SECTIONS = {
  arrival: [{
    title: '到货明细',
    arrayPath: 'arrivalOrders',
    fields: {
      物料编码: 'product_cCode',
      物料名称: 'product_cName',
      到货数量: 'qty',
      实收数量: 'acceptqty',
      拒收数量: 'refuseqty',
      主计量单位: 'unit_name',
    },
  }],
  purchaseInbound: [{
    title: '入库明细',
    arrayPath: 'purInRecords',
    fields: {
      物料编码: 'product_cCode',
      物料名称: 'product_cName',
      批次号: 'batchno',
      数量: 'qty',
      库存单位: 'stockUnit_name',
    },
  }],
  productionOrder: [{
    title: '生产明细',
    arrayPath: 'orderProduct',
    fields: {
      行号: 'lineNo',
      物料编码: 'productCode',
      物料名称: 'productName',
      生产数量: 'quantity',
      生产单位: 'productUnitName',
    },
  }],
  materialOutbound: [{
    title: '出库明细',
    arrayPath: 'materOuts',
    fields: {
      物料编码: 'product_cCode',
      物料名称: 'product_cName',
      批次号: 'batchno',
      数量: 'qty',
      库存单位: 'stockUnit_name',
    },
  }],
  productInbound: [
    {
      title: '入库明细',
      arrayPath: 'storeProRecords',
      fields: {
        物料编码: 'product_cCode',
        物料名称: 'product_cName',
        '序列号/设备SN': 'id',
        '批次号/机器人编号': 'batchno',
        数量: 'qty',
        库存单位: 'stockUnit_name',
      },
    },
  ],
  salesOutbound: [{
    title: '出库明细',
    arrayPath: 'details',
    fields: {
      物料编码: 'product_cCode',
      物料名称: 'product_cName',
      SKU编码: 'productsku_cCode',
      SKU名称: 'productsku_cName',
      '批次号/机器人编号': 'batchno',
      数量: 'qty',
      库存单位: 'stockUnit_name',
      主计量: 'unitName',
    },
  }],
  transferOrder: [{
    title: '调拨明细',
    arrayPath: 'transferApplys',
    fields: {
      物料编码: 'product_cCode',
      物料名称: 'product_cName',
      '批次号/机器人编号': 'batchno',
      数量: 'qty',
      库存单位: 'stockUnit_name',
    },
  }],
};
const DETAIL_FIELD_RULES = {
  arrival: {
    物料编码: { arrayPath: 'arrivalOrders', itemPath: 'product_cCode', aggregate: 'uniqueText' },
    物料名称: { arrayPath: 'arrivalOrders', itemPath: 'product_cName', aggregate: 'uniqueText' },
    主计量单位: { arrayPath: 'arrivalOrders', itemPath: 'unit_name', aggregate: 'uniqueText' },
    到货数量: { arrayPath: 'arrivalOrders', itemPath: 'qty', aggregate: 'sum' },
    实收数量: { arrayPath: 'arrivalOrders', itemPath: 'acceptqty', aggregate: 'sum' },
    拒收数量: { arrayPath: 'arrivalOrders', itemPath: 'refuseqty', aggregate: 'sum' },
    含税单价: { arrayPath: 'arrivalOrders', itemPath: 'oriTaxUnitPrice', aggregate: 'uniqueText' },
    含税金额: { arrayPath: 'arrivalOrders', itemPath: 'oriSum', aggregate: 'sum' },
    税额: { arrayPath: 'arrivalOrders', itemPath: 'oriTax', aggregate: 'sum' },
  },
  productInbound: {
    '序列号/设备SN': { arrayPath: 'storeProRecords', itemPath: 'id', aggregate: 'uniqueText' },
    '批次号/机器人编号': { arrayPath: 'storeProRecords', itemPath: 'batchno', aggregate: 'uniqueText' },
  },
};
Object.assign(DETAIL_FIELD_PATHS.arrival, {
  单据日期: 'vouchdate',
  到货单号: 'code',
  收货组织: 'org_name',
  交易类型: 'busType_name',
  采购组织: 'purchaseOrg_name',
  供货供应商: 'vendor_name',
  单据状态: 'status',
  物料编码: 'arrivalOrders.0.product_cCode',
  物料名称: 'arrivalOrders.0.product_cName',
  主计量单位: 'arrivalOrders.0.unit_name',
  到货数量: 'arrivalOrders.0.qty',
  实收数量: 'arrivalOrders.0.acceptqty',
  拒收数量: 'arrivalOrders.0.refuseqty',
  原单补货数量: 'returncount',
  含税单价: 'arrivalOrders.0.oriTaxUnitPrice',
  含税金额: 'arrivalOrders.0.oriSum',
  税额: 'arrivalOrders.0.oriTax',
});
Object.assign(DETAIL_FIELD_PATHS.productInspection, {
  单据日期: 'inspectDate',
  检验单号: 'code',
  质检组织: 'pk_org_name',
  交易类型: 'trantype_name',
  单据状态: 'verifystate',
  物料编码: 'pk_material_code',
  物料名称: 'pk_material_name',
  检验数量: 'inspectnum',
  主计量: 'cunitid_name',
  检验件数: 'inspectastnum',
  检验单位: 'castunitid_name',
  检验结果: 'inspectResult',
  处理方式: 'qms_qit_incominspectorder_resultList.0.handleType_name',
  处理数量: 'qms_qit_incominspectorder_resultList.0.nnum',
});
Object.assign(DETAIL_FIELD_PATHS.purchaseInbound, {
  单据日期: 'vouchdate',
  单据编号: 'code',
  库存组织: 'org_name',
  交易类型: 'bustype_name',
  供应商: 'vendor_name',
  仓库: 'warehouse_name',
  单据状态: 'status',
  备注: 'memo',
  物料编码: 'purInRecords.0.product_cCode',
  物料名称: 'purInRecords.0.product_cName',
  件数: 'purInRecords.0.subQty',
  库存单位: 'purInRecords.0.stockUnit_name',
  数量: 'purInRecords.0.qty',
  主计量: 'purInRecords.0.unit_name',
  无税单价: 'purInRecords.0.natUnitPrice',
  无税金额: 'purInRecords.0.natMoney',
  含税单价: 'purInRecords.0.oriTaxUnitPrice',
  含税金额: 'purInRecords.0.oriSum',
  税额: 'purInRecords.0.oriTax',
});
Object.assign(DETAIL_FIELD_PATHS.productionOrder, {
  单据日期: 'vouchdate',
  生产订单号: 'code',
  工厂: 'orgName',
  交易类型: 'transTypeName',
  生产部门: 'departmentName',
  订单状态: 'status',
  行号: 'orderProduct.0.lineNo',
  物料编码: 'orderProduct.0.productCode',
  物料名称: 'orderProduct.0.productName',
  生产数量: 'orderProduct.0.quantity',
  主计量: 'orderProduct.0.mainUnitName',
  生产件数: 'orderProduct.0.auxiliaryQuantity',
  生产单位: 'orderProduct.0.productUnitName',
  开工日期: 'orderProduct.0.startDate',
  完工日期: 'orderProduct.0.finishDate',
});
Object.assign(DETAIL_FIELD_PATHS.materialOutbound, {
  单据日期: 'vouchdate',
  单据编号: 'code',
  库存组织: 'org_name',
  交易类型: 'bustype_name',
  部门: 'department_name',
  业务员: 'operator_name',
  仓库: 'warehouse_name',
  库管员: 'stockMgr_name',
  单据状态: 'status',
  备注: null,
  物料编码: 'materOuts.0.product_cCode',
  物料名称: 'materOuts.0.product_cName',
  件数: 'materOuts.0.subQty',
  库存单位: 'materOuts.0.stockUnit_name',
  数量: 'materOuts.0.qty',
  批次号: 'materOuts.0.batchno',
});
Object.assign(DETAIL_FIELD_PATHS.productInbound, {
  单据日期: 'vouchdate',
  单据编号: 'code',
  '序列号/设备SN': null,
  '批次号/机器人编号': 'storeProRecords.0.batchno',
});
Object.assign(DETAIL_FIELD_PATHS.salesOutbound, {
  单据日期: 'vouchdate',
  单据编号: 'code',
  库存组织: 'org_name',
  交易类型: 'bustype_name',
  客户: 'cust_name',
  销售部门: 'department_name',
  单据状态: 'status',
  备注: 'memo',
  物料编码: 'details.0.product_cCode',
  物料名称: 'details.0.product_cName',
  SKU编码: 'details.0.productsku_cCode',
  SKU名称: 'details.0.productsku_cName',
  件数: 'details.0.subQty',
  库存单位: 'details.0.stockUnit_name',
  数量: 'details.0.qty',
  主计量: 'details.0.unitName',
});
Object.assign(DETAIL_FIELD_PATHS.transferOrder, {
  单据日期: 'vouchdate',
  单据编号: 'code',
  调出仓库: 'outwarehouse_name',
  调入仓库: 'inwarehouse_name',
  数量: 'transferApplys.0.qty',
});

function valueAtPath(source, path) {
  if (!path) return undefined;
  return path.split('.').reduce((value, segment) => value?.[segment], source);
}

function formatDate(value) {
  if (!value) return '';
  return String(value).replace('T', ' ').slice(0, 10);
}

function displayValue(value) {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

const INSPECTION_DOCUMENT_STATUS = {
  0: '待检',
  1: '审批中',
  2: '已审批',
  4: '已驳回',
  10: '检验完成',
  11: '开立',
};
const PURCHASE_INBOUND_DOCUMENT_STATUS = {
  0: '开立',
  1: '已审核',
  3: '审核中',
};

function formatBusinessValue(typeKey, label, value) {
  if (
    typeKey === 'productInspection'
    && label === '单据状态'
    && value !== undefined
    && value !== null
    && value !== ''
  ) {
    return INSPECTION_DOCUMENT_STATUS[String(value)] || `未知状态（${value}）`;
  }
  if (
    typeKey === 'purchaseInbound'
    && label === '单据状态'
    && value !== undefined
    && value !== null
    && value !== ''
  ) {
    return PURCHASE_INBOUND_DOCUMENT_STATUS[String(value)] || `未知状态（${value}）`;
  }
  return value;
}

function makeCondition(field, value, op = 'like') {
  return value ? { field, op, value1: value, logicOp: 'and' } : null;
}

function buildRequestBody(typeKey, filters, page, pageSize) {
  const config = ERP_API_CONFIG[typeKey];
  const body = {
    ...config.defaults,
    pageIndex: config.zeroBasedPage ? page - 1 : page,
    pageSize,
  };
  const conditions = [];
  const { query, dateFrom, dateTo, extras = {} } = filters;

  if (typeKey === 'arrival') {
    if (query) body.code = query;
    if (dateFrom) body.open_vouchdate_begin = dateFrom;
    if (dateTo) body.open_vouchdate_end = dateTo;
    if (extras.供货供应商) body.vendor = extras.供货供应商;
  } else if (typeKey === 'productInspection') {
    if (query) body.code = query;
    body.simple = {
      ...(dateFrom ? { open_inspectDate_begin: dateFrom } : {}),
      ...(dateTo ? { open_inspectDate_end: dateTo } : {}),
    };
    conditions.push(makeCondition('pk_material_name', extras.物料名称));
  } else if (typeKey === 'purchaseInbound') {
    if (query) body.code = query;
    if (dateFrom) body.open_vouchdate_begin = dateFrom;
    if (dateTo) body.open_vouchdate_end = dateTo;
    if (extras.供应商) body.vendor_name = extras.供应商;
    conditions.push(makeCondition('product_cName', extras.物料名称));
  } else if (typeKey === 'productionOrder') {
    if (query) body.code = query;
    conditions.push(
      makeCondition('vouchdate', dateFrom, 'egt'),
      makeCondition('vouchdate', dateTo, 'elt'),
      makeCondition('OrderProduct.product_cName', extras.物料名称),
    );
  } else if (typeKey === 'materialOutbound') {
    if (query) body.code = query;
    if (dateFrom) body.open_vouchdate_begin = dateFrom;
    if (dateTo) body.open_vouchdate_end = dateTo;
    if (extras.物料名称) body.product_cName = [extras.物料名称];
    if (extras.仓库) {
      conditions.push({
        field: 'warehouse',
        op: 'eq',
        value1: extras.仓库,
      });
    }
  } else if (typeKey === 'productInbound') {
    if (query) body.code = query;
    if (dateFrom) body.open_vouchdate_begin = dateFrom;
    if (dateTo) body.open_vouchdate_end = dateTo;
    if (extras.批次号) {
      conditions.push({
        field: 'storeProRecords.batchno',
        op: 'like',
        value1: extras.批次号,
      });
    }
  } else if (typeKey === 'salesOutbound') {
    if (query) body.code = query;
    if (dateFrom && dateTo) {
      body.vouchdate = `${dateFrom}|${dateTo} 23:59:59`;
    } else if (dateFrom) {
      body.vouchdate = dateFrom;
    } else if (dateTo) {
      conditions.push({
        field: 'vouchdate',
        op: 'elt',
        value1: `${dateTo} 23:59:59`,
      });
    }
    if (extras.客户) body.cust = extras.客户;
    if (extras.库存组织) body.stockOrg = extras.库存组织;
    if (extras.批次号) {
      conditions.push({
        field: 'details.batchno',
        op: 'eq',
        value1: extras.批次号,
      });
    }
  } else if (typeKey === 'transferOrder') {
    if (query) body.code = query;
    if (dateFrom) body.open_vouchdate_begin = dateFrom;
    if (dateTo) body.open_vouchdate_end = dateTo;
    if (extras.调出仓库) body.outwarehouse = extras.调出仓库;
    if (extras.调入仓库) body.inwarehouse = extras.调入仓库;
    if (extras.批次号) {
      conditions.push({
        field: 'transferApplys.batchno',
        op: 'eq',
        value1: extras.批次号,
      });
    }
  }

  const compactConditions = conditions.filter(Boolean);
  if (compactConditions.length) body.simpleVOs = compactConditions;
  if (body.simple && Object.keys(body.simple).length === 0) delete body.simple;
  return body;
}

async function requestJson(path: string, options: RequestInit = {}) {
  const payload = await mockErpResponse(path, options);
  const code = payload?.code === undefined ? '' : String(payload.code);
  if (code && !['200', '00000'].includes(code)) {
    throw new Error(payload?.message || 'ERP 接口请求失败');
  }
  return payload;
}

function normalizeRecord(typeKey, source, index) {
  const config = ERP_API_CONFIG[typeKey];
  const id = String(source?.id ?? '');
  const docNo = String(source?.code ?? '');
  const docDate = formatDate(valueAtPath(source, typeKey === 'productInspection' ? 'inspectDate' : 'vouchdate'));
  const fields = Object.fromEntries(
    Object.entries(config.fields).map(([label, fieldPath]) => [
      label,
      formatBusinessValue(
        typeKey,
        label,
        fieldPath ? valueAtPath(source, fieldPath) : undefined,
      ),
    ]),
  );
  return {
    id: `${id || docNo || 'record'}-${index}`,
    businessId: id,
    docNo,
    docDate,
    fields,
    raw: source,
  };
}

function aggregateDetailField(detailData, rule) {
  const items = valueAtPath(detailData, rule.arrayPath);
  if (!Array.isArray(items)) return undefined;
  const values = items
    .map((item) => valueAtPath(item, rule.itemPath))
    .filter((value) => value !== undefined && value !== null && value !== '');

  if (rule.aggregate === 'sum') {
    if (!values.length) return undefined;
    return values.reduce((total, value) => total + (Number(value) || 0), 0);
  }
  if (rule.aggregate === 'uniqueText') {
    return [...new Set(values.map(String))].join('、') || undefined;
  }
  return undefined;
}

function buildListChildSections(typeKey, detailData) {
  return (LIST_CHILD_SECTIONS[typeKey] || [])
    .map((section) => {
      const items = valueAtPath(detailData, section.arrayPath);
      const columns = Object.keys(section.fields);
      const rows = Array.isArray(items)
        ? items.map((item, index) => ({
          id: String(item?.id ?? `${section.arrayPath}-${index}`),
          fields: Object.fromEntries(
            Object.entries(section.fields).map(([label, fieldRule]) => [
              label,
              typeof fieldRule === 'string'
                ? valueAtPath(item, fieldRule)
                : aggregateDetailField(item, fieldRule),
            ]),
          ),
        }))
        : [];
      return { title: section.title, columns, rows };
    })
    .filter((section) => section.rows.length > 0);
}

export async function fetchErpList(typeKey, { filters, page, pageSize, signal = undefined }) {
  const config = ERP_API_CONFIG[typeKey];
  if (!config) throw new Error(`不支持的 ERP 单据类型：${typeKey}`);
  if (Object.values(filters?.extras || {}).includes(ERP_FILTER_NO_MATCH)) {
    return {
      records: [], total: 0, totalPages: 1, raw: null, filterOptions: {},
    };
  }
  const payload = await requestJson(config.listPath, {
    method: 'POST',
    body: JSON.stringify(buildRequestBody(typeKey, filters, page, pageSize)),
    signal,
  });
  const data = payload?.data || {};
  const sourceRecords = Array.isArray(data.recordList)
    ? data.recordList
    : Array.isArray(data.rows)
      ? data.rows
      : Array.isArray(data)
        ? data
        : [];
  const seenDocuments = new Set();
  const records = sourceRecords
    .map((record, index) => normalizeRecord(typeKey, record, index))
    .filter((record) => {
      const documentKey = record.businessId || record.docNo || record.id;
      if (seenDocuments.has(documentKey)) return false;
      seenDocuments.add(documentKey);
      return true;
    });
  const total = Number(data.recordCount ?? data.totalCount ?? data.total ?? records.length) || 0;
  const totalPages = Number(data.pageCount) || Math.max(1, Math.ceil(total / pageSize));
  return {
    records,
    total,
    totalPages,
    raw: payload,
    filterOptions: extractFilterOptions(typeKey, sourceRecords),
  };
}

function collectNamedIdOptions(records, mappings: Record<string, { idField: string; nameField: string }>) {
  const optionMaps = Object.fromEntries(
    Object.keys(mappings).map((key) => [key, new Map()]),
  );
  records.forEach((record) => {
    Object.entries(mappings).forEach(([key, { idField, nameField }]) => {
      const id = String(record?.[idField] ?? '');
      const name = String(record?.[nameField] ?? '');
      if (id && name) optionMaps[key].set(id, name);
    });
  });
  return Object.fromEntries(
    Object.entries(optionMaps).map(([key, values]) => [
      key,
      [...values.entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN')),
    ]),
  );
}

function extractFilterOptions(typeKey, records) {
  if (typeKey === 'arrival') {
    return collectNamedIdOptions(records, {
      vendors: { idField: 'vendor', nameField: 'vendor_name' },
    });
  }
  if (typeKey === 'materialOutbound') {
    return collectNamedIdOptions(records, {
      warehouses: { idField: 'warehouse', nameField: 'warehouse_name' },
      products: { idField: 'materOuts_product', nameField: 'product_cName' },
    });
  }
  if (typeKey === 'salesOutbound') {
    return collectNamedIdOptions(records, {
      customers: { idField: 'cust', nameField: 'cust_name' },
      stockOrganizations: { idField: 'org', nameField: 'org_name' },
    });
  }
  if (typeKey === 'transferOrder') {
    return collectNamedIdOptions(records, {
      outboundWarehouses: { idField: 'outwarehouse', nameField: 'outwarehouse_name' },
      inboundWarehouses: { idField: 'inwarehouse', nameField: 'inwarehouse_name' },
    });
  }
  return {};
}

async function requestErpDetailData(typeKey, record, signal = undefined) {
  const config = ERP_API_CONFIG[typeKey];
  if (!config) throw new Error(`不支持的 ERP 单据类型：${typeKey}`);
  const params = new URLSearchParams(config.detailParams || {});
  if (record.businessId) params.set('id', record.businessId);
  if (typeKey === 'productInspection' && record.docNo) params.set('code', record.docNo);
  if (!params.has('id') && !params.has('code')) throw new Error('当前记录缺少详情查询所需的业务 ID');
  const payload = await requestJson(`${config.detailPath}?${params.toString()}`, { method: 'GET', signal });
  return payload?.data ?? {};
}

export async function fetchErpChildSections(typeKey, record, signal = undefined) {
  const data = await requestErpDetailData(typeKey, record, signal);
  return buildListChildSections(typeKey, data);
}

export async function fetchErpDetail(typeKey, record, signal = undefined) {
  const data = await requestErpDetailData(typeKey, record, signal);
  return {
    ...record,
    childSections: buildListChildSections(typeKey, data),
    detailFields: (DETAIL_FIELDS[typeKey] || []).map((label) => [
      label,
      displayValue(
        formatBusinessValue(
          typeKey,
          label,
          DETAIL_FIELD_RULES[typeKey]?.[label]
            ? aggregateDetailField(data, DETAIL_FIELD_RULES[typeKey][label])
            : valueAtPath(data, DETAIL_FIELD_PATHS[typeKey]?.[label]),
        ),
      ),
    ]),
  };
}
