import { createHmac } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const pageSize = 10;
const pagesPerType = 2;
const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:18088';
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) throw new Error('JWT_SECRET is required');

const configs = {
  'arrival-orders': { path: '/api/yonyou/arrival-orders/query', detailPath: '/api/yonyou/arrival-orders/detail', defaults: { isSum: true } },
  'inspect-orders': {
    path: '/api/yonyou/inspect-orders/query',
    detailPath: '/api/yonyou/inspect-orders/detail',
    detailParams: { billnum: 'qms_incominspectorder_card' },
    detailUsesCode: true,
    defaults: { billnum: 'qms_incominspectorder_list' },
    zeroBased: true,
  },
  'purchase-in-records': { path: '/api/yonyou/purchase-in-records/query', detailPath: '/api/yonyou/purchase-in-records/detail', defaults: { isSum: true } },
  // Production-order list rows are material lines: one document can occupy
  // several upstream rows. Read two wider source pages, then retain the first
  // two frontend pages of distinct real documents.
  'production-orders': {
    path: '/api/yonyou/production-orders/query',
    detailPath: '/api/yonyou/production-orders/detail',
    defaults: {},
    sourcePageSize: 30,
    uniqueDocuments: true,
  },
  'material-outs': { path: '/api/yonyou/material-outs/query', detailPath: '/api/yonyou/material-outs/detail', defaults: { isSum: true } },
  'product-in-records': { path: '/api/yonyou/product-in-records/query', detailPath: '/api/yonyou/product-in-records/detail', defaults: { isSum: true } },
  'sales-outs': { path: '/api/yonyou/sales-outs/query', detailPath: '/api/yonyou/sales-outs/detail', defaults: { isSum: true } },
  'transfer-orders': { path: '/api/yonyou/transfer-orders/query', detailPath: '/api/yonyou/transfer-orders/detail', defaults: { isSum: true } },
};

const base64url = (value) => Buffer.from(value).toString('base64url');
const issuedAt = Math.floor(Date.now() / 1000);
const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
const payload = base64url(JSON.stringify({
  sub: process.env.JWT_USERNAME || 'admin',
  role: '管理员',
  iat: issuedAt,
  exp: issuedAt + 3600,
}));
const unsigned = `${header}.${payload}`;
const signature = createHmac('sha256', jwtSecret).update(unsigned).digest('base64url');
const token = `${unsigned}.${signature}`;

function parseJsonPreservingLongIds(text) {
  return JSON.parse(text.replace(/([:[,]\s*)(-?\d{16,})(?=\s*[,}\]])/g, '$1"$2"'));
}

const snapshot = {
  snapshotVersion: 1,
  exportedAt: new Date().toISOString(),
  pageSize,
  pagesPerType,
  pageInfo: {},
  fixtures: {},
  details: {},
};

for (const [type, config] of Object.entries(configs)) {
  const records = [];
  const pageInfo = [];
  const sourcePageSize = config.sourcePageSize || pageSize;
  for (let page = 1; page <= pagesPerType; page += 1) {
    const body = {
      ...config.defaults,
      pageIndex: config.zeroBased ? page - 1 : page,
      pageSize: sourcePageSize,
    };
    const response = await fetch(`${backendUrl}${config.path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    const result = text ? parseJsonPreservingLongIds(text) : {};
    const code = result?.code === undefined ? '' : String(result.code);
    if (!response.ok || (code && !['200', '00000'].includes(code))) {
      throw new Error(`${type} page ${page} failed: ${result?.message || `HTTP ${response.status}`}`);
    }
    const data = result?.data || {};
    const pageRecords = Array.isArray(data.recordList) ? data.recordList
      : Array.isArray(data.rows) ? data.rows : Array.isArray(data) ? data : [];
    records.push(...pageRecords);
    pageInfo.push({
      page,
      returned: pageRecords.length,
      total: Number(data.recordCount ?? data.totalCount ?? data.total ?? pageRecords.length) || 0,
      pageCount: Number(data.pageCount) || null,
    });
  }
  if (config.uniqueDocuments) {
    const seen = new Set();
    snapshot.fixtures[type] = records
      .filter((record, index) => {
        const key = String(record?.id ?? record?.code ?? index);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, pageSize * pagesPerType);
  } else {
    // Keep the exact rows returned by both requested pages. Most ERP lists
    // already return one row per document or intentionally expose detail rows.
    snapshot.fixtures[type] = records;
  }
  snapshot.pageInfo[type] = pageInfo;
  console.log(`${type}: ${snapshot.fixtures[type].length} retained from ${records.length} rows across ${pagesPerType} pages`);

  const detailEntries = new Map();
  for (const record of snapshot.fixtures[type]) {
    const key = String(record?.id ?? record?.code ?? '');
    if (key && !detailEntries.has(key)) detailEntries.set(key, record);
  }
  snapshot.details[type] = {};
  const targets = [...detailEntries.entries()];
  for (let offset = 0; offset < targets.length; offset += 4) {
    await Promise.all(targets.slice(offset, offset + 4).map(async ([key, record]) => {
      const params = new URLSearchParams(config.detailParams || {});
      if (record?.id !== undefined && record?.id !== null && record?.id !== '') params.set('id', String(record.id));
      if (config.detailUsesCode && record?.code) params.set('code', String(record.code));
      const response = await fetch(`${backendUrl}${config.detailPath}?${params}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const text = await response.text();
      const result = text ? parseJsonPreservingLongIds(text) : {};
      const code = result?.code === undefined ? '' : String(result.code);
      if (!response.ok || (code && !['200', '00000'].includes(code))) {
        throw new Error(`${type} detail ${key} failed: ${result?.message || `HTTP ${response.status}`}`);
      }
      snapshot.details[type][key] = result?.data ?? {};
    }));
  }
  console.log(`${type}: ${Object.keys(snapshot.details[type]).length} real details captured`);
}

const outputPath = resolve('src/mock/erpSnapshot.json');
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`ERP snapshot written to ${outputPath}`);
