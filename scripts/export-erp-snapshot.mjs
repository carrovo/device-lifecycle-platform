import { createHmac } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const pageSize = 10;
const pagesPerType = 2;
const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:18088';
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) throw new Error('JWT_SECRET is required');

const configs = {
  'arrival-orders': { path: '/api/yonyou/arrival-orders/query', defaults: { isSum: true } },
  'inspect-orders': { path: '/api/yonyou/inspect-orders/query', defaults: { billnum: 'qms_incominspectorder_list' }, zeroBased: true },
  'purchase-in-records': { path: '/api/yonyou/purchase-in-records/query', defaults: { isSum: true } },
  'production-orders': { path: '/api/yonyou/production-orders/query', defaults: {} },
  'material-outs': { path: '/api/yonyou/material-outs/query', defaults: { isSum: true } },
  'product-in-records': { path: '/api/yonyou/product-in-records/query', defaults: { isSum: true } },
  'sales-outs': { path: '/api/yonyou/sales-outs/query', defaults: { isSum: true } },
  'transfer-orders': { path: '/api/yonyou/transfer-orders/query', defaults: { isSum: true } },
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
};

for (const [type, config] of Object.entries(configs)) {
  const records = [];
  const pageInfo = [];
  for (let page = 1; page <= pagesPerType; page += 1) {
    const body = {
      ...config.defaults,
      pageIndex: config.zeroBased ? page - 1 : page,
      pageSize,
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
  // Keep the exact rows returned by both requested pages. Some ERP lists reuse
  // a document id for multiple detail rows, so id/code based de-duplication
  // would incorrectly discard real records.
  snapshot.fixtures[type] = records;
  snapshot.pageInfo[type] = pageInfo;
  console.log(`${type}: ${snapshot.fixtures[type].length} records from ${pagesPerType} pages`);
}

const outputPath = resolve('src/mock/erpSnapshot.json');
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`ERP snapshot written to ${outputPath}`);
