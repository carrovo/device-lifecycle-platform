import { erpDocs } from './erpDocs';

export const TRANSFER_RECORDS = [
  {
    id: 'DB-2026-001',
    docNo: 'DB-2026-001',
    docDate: '2026-06-28',
    fields: {
      单据编号: 'DB-2026-001',
      单据日期: '2026-06-28',
      调出仓库: '成品库',
      调入仓库: '项目备货区',
      数量: 4,
    },
  },
  {
    id: 'DB-2026-002',
    docNo: 'DB-2026-002',
    docDate: '2026-07-03',
    fields: {
      单据编号: 'DB-2026-002',
      单据日期: '2026-07-03',
      调出仓库: '成品库',
      调入仓库: '机场项目备货区',
      数量: 2,
    },
  },
];

export function deliveryErpReferences() {
  return [
    ...(erpDocs.salesOutbound || []).map((record) => ({
      type: '销售发货单',
      no: record.docNo,
      date: record.docDate,
      summary: [record.fields?.客户, record.fields?.仓库].filter(Boolean).join(' · '),
    })),
    ...TRANSFER_RECORDS.map((record) => ({
      type: '调拨订单',
      no: record.docNo,
      date: record.docDate,
      summary: [record.fields?.调出仓库, record.fields?.调入仓库].filter(Boolean).join(' → '),
    })),
  ];
}

export function erpReferenceUrl(reference, returnTo = '') {
  const type = reference?.type === '调拨订单' ? 'transferOrder' : 'salesOutbound';
  const params = new URLSearchParams({ tab: 'list', type, doc: reference?.no || '' });
  if (returnTo) params.set('returnTo', returnTo);
  return `/erp-center?${params.toString()}`;
}
