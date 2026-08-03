import { useState } from 'react';
import { fetchErpList } from '../api/yonyouErp';
import { Btn, EmptyState, Input, Select } from './ui';

const TYPE_OPTIONS = [
  { key: 'salesOutbound', label: '销售出库单' },
  { key: 'transferOrder', label: '调拨订单' },
];

function dateWindow(referenceDate) {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(referenceDate || '')
    ? new Date(`${referenceDate}T00:00:00`)
    : new Date();
  const end = new Date(parsed);
  const start = new Date(parsed);
  start.setDate(start.getDate() - 90);
  const text = (value) => [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-');
  return { dateFrom: text(start), dateTo: text(end) };
}

function referenceKey(item) {
  return `${item.type}::${item.no}`;
}

function toReference(typeKey, record) {
  const transfer = typeKey === 'transferOrder';
  return {
    type: transfer ? '调拨订单' : '销售出库单',
    no: record.docNo,
    date: record.docDate,
    summary: transfer
      ? [record.fields?.调出仓库, record.fields?.调入仓库].filter(Boolean).join(' → ')
      : [record.fields?.客户, record.fields?.库存组织].filter(Boolean).join(' · '),
    businessId: record.businessId || '',
  };
}

export default function ErpReferencePicker({ value, onChange, referenceDate, projectClient }) {
  const window = dateWindow(referenceDate);
  const [typeKey, setTypeKey] = useState('salesOutbound');
  const [code, setCode] = useState('');
  const [dateFrom, setDateFrom] = useState(window.dateFrom);
  const [dateTo, setDateTo] = useState(window.dateTo);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const safeValue = Array.isArray(value) ? value : [];
  const selectedKeys = new Set(safeValue.map(referenceKey));
  const search = async () => {
    const query = code.trim();
    if (!query && !dateFrom && !dateTo) {
      setError('请输入单据编号，或至少保留一个单据日期条件。');
      return;
    }
    setLoading(true);
    setSearched(true);
    setError('');
    try {
      const result = await fetchErpList(typeKey, {
        filters: { query, dateFrom, dateTo, extras: {} },
        page: 1,
        pageSize: 20,
      });
      setRecords((Array.isArray(result?.records) ? result.records : []).map((item) => toReference(typeKey, item)).filter((item) => item.no));
    } catch (requestError) {
      setRecords([]);
      setError(requestError.message || 'ERP 单据查询失败');
    } finally {
      setLoading(false);
    }
  };
  const toggle = (item) => {
    const key = referenceKey(item);
    onChange(selectedKeys.has(key)
      ? safeValue.filter((current) => referenceKey(current) !== key)
      : [...safeValue, item]);
  };

  return <div className="space-y-3">
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <Select value={typeKey} onChange={(event) => { setTypeKey(event.target.value); setRecords([]); setSearched(false); }}>
        {TYPE_OPTIONS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
      </Select>
      <Input placeholder="输入单据编号，如 XSCK20210601000001" value={code} onChange={(event) => setCode(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') search(); }} />
      <div><label className="block text-[11px] text-gray-500 mb-1">单据日期起</label><Input className="w-full" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></div>
      <div><label className="block text-[11px] text-gray-500 mb-1">单据日期止</label><Input className="w-full" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-gray-400">仅点击查询时访问 ERP，单次最多返回 20 条；默认限制为参考日期前 90 天。</p>
      <Btn size="sm" variant="primary" disabled={loading} onClick={search}>{loading ? '查询中…' : '查询 ERP 单据'}</Btn>
    </div>
    {projectClient && <p className="text-xs text-gray-400">当前项目客户：{projectClient}。ERP 查询要求客户 ID，暂不自动按客户名称过滤，避免漏单。</p>}
    {error && <p className="text-xs text-red-600">{error}</p>}
    {safeValue.length > 0 && <div className="rounded-md border border-blue-100 bg-blue-50/40 px-3 py-2 text-xs">
      <span className="text-gray-500">已选择 {safeValue.length} 张：</span>
      <span className="ml-2 font-mono text-gray-700">{safeValue.map((item) => item.no).join('、')}</span>
    </div>}
    <div className="max-h-48 overflow-y-auto rounded-md border border-gray-200 divide-y divide-gray-100">
      {records.map((item) => {
        const key = referenceKey(item);
        return <label key={key} className="flex items-start gap-3 px-3 py-2 text-xs hover:bg-gray-50"><input className="mt-0.5" type="checkbox" checked={selectedKeys.has(key)} onChange={() => toggle(item)} /><span className="min-w-20 text-gray-700">{item.type}</span><span className="font-mono">{item.no}</span><span className="text-gray-400">{item.date} {item.summary}</span></label>;
      })}
      {searched && !loading && !records.length && !error && <EmptyState className="py-6">未查询到符合条件的 ERP 单据</EmptyState>}
      {!searched && <EmptyState className="py-6">请输入单据编号或确认日期范围后查询</EmptyState>}
    </div>
  </div>;
}
